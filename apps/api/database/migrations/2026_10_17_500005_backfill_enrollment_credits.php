<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Concilia os dados atuais com o livro-razão, uma única vez (chaves de deduplicação impedem repetição):
     * - contracted_minutes vira o saldo inicial (pacote "initial"), sem categoria em matrículas conjuntas (AB...);
     * - aulas agendadas viram reserva; realizadas viram consumo pela duração real (ou agendada);
     * - faltas e cancelamentos antigos não consumiram nada, pois não havia política contratada.
     */
    public function up(): void
    {
        $simple = ['A', 'B', 'C', 'D', 'E', 'ACC'];
        $now = now();

        DB::table('enrollments')->orderBy('id')->chunkById(200, function ($enrollments) use ($simple, $now) {
            foreach ($enrollments as $enrollment) {
                $category = in_array($enrollment->category, $simple, true) ? $enrollment->category : null;

                if ($enrollment->contracted_minutes) {
                    $packageId = DB::table('enrollment_packages')->insertGetId([
                        'organization_id' => $enrollment->organization_id,
                        'enrollment_id' => $enrollment->id,
                        'kind' => 'initial',
                        'category' => $category,
                        'description' => 'Saldo inicial conciliado (minutos contratados anteriormente)',
                        'minutes' => $enrollment->contracted_minutes,
                        'price_cents' => $enrollment->price_cents,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);

                    DB::table('enrollment_credit_entries')->insert([
                        'organization_id' => $enrollment->organization_id,
                        'enrollment_id' => $enrollment->id,
                        'package_id' => $packageId,
                        'bucket' => 'credit',
                        'type' => 'initial_balance',
                        'category' => $category,
                        'minutes' => $enrollment->contracted_minutes,
                        'reason' => 'Saldo inicial conciliado na implantação do controle de saldo.',
                        'dedupe_key' => "enrollment:{$enrollment->id}:initial",
                        'occurred_at' => $now,
                    ]);
                }

                $lessons = DB::table('lessons')
                    ->leftJoin('vehicles', 'vehicles.id', '=', 'lessons.vehicle_id')
                    ->where('lessons.enrollment_id', $enrollment->id)
                    ->whereIn('lessons.status', ['scheduled', 'completed'])
                    ->select('lessons.*', 'vehicles.category as vehicle_category')
                    ->get();

                foreach ($lessons as $lesson) {
                    $lessonCategory = $category ?? $lesson->vehicle_category;
                    DB::table('lessons')->where('id', $lesson->id)->update(['category' => $lessonCategory]);

                    $scheduled = (int) round((strtotime($lesson->ends_at) - strtotime($lesson->starts_at)) / 60);
                    $completed = $lesson->status === 'completed';

                    DB::table('enrollment_credit_entries')->insert([
                        'organization_id' => $enrollment->organization_id,
                        'enrollment_id' => $enrollment->id,
                        'lesson_id' => $lesson->id,
                        'bucket' => $completed ? 'consume' : 'reserve',
                        'type' => $completed ? 'consume' : 'reserve',
                        'category' => $lessonCategory,
                        'minutes' => $completed ? ($lesson->actual_minutes ?? $scheduled) : $scheduled,
                        'reason' => 'Conciliação de aula existente.',
                        'dedupe_key' => "lesson:{$lesson->id}:".($completed ? 'consume' : 'reserve'),
                        'occurred_at' => $now,
                    ]);
                }
            }
        });
    }

    public function down(): void
    {
        DB::table('enrollment_credit_entries')->delete();
        DB::table('enrollment_packages')->delete();
    }
};
