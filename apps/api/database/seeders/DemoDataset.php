<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Posse explícita dos dados de demonstração. A organização é a fronteira de limpeza;
 * usuários e perfis globais só são apagados se não tiverem vínculos externos.
 */
final class DemoDataset
{
    /** @param Closure(): array{0: User, 1: Organization, 2?: list<User>} $build */
    public function rebuildDemoDataset(string $key, string $email, Closure $build): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('Seeders de demonstração só podem rodar em local/testing.');
        }

        $oldFiles = DB::transaction(function () use ($key, $email, $build): array {
            $previous = DB::table('demo_datasets')->where('key', $key)->lockForUpdate()->first();
            $files = [];

            if ($previous !== null) {
                $ownedUserIds = DB::table('demo_dataset_users')->where('dataset_key', $key)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
                $files = DB::table('documents')->where('organization_id', $previous->organization_id)
                    ->where('storage_path', 'like', "demo/{$key}/%")
                    ->pluck('storage_path')->all();
                DB::table('demo_datasets')->where('key', $key)->delete();
                $this->purge((int) $previous->organization_id, $ownedUserIds);
            }

            if (User::query()->where('email', $email)->exists()) {
                throw new RuntimeException("A conta {$email} já existe fora desta demonstração.");
            }

            [$user, $organization, $additionalUsers] = array_pad($build(), 3, []);

            DB::table('demo_datasets')->insert([
                'key' => $key,
                'organization_id' => $organization->getKey(),
                'user_id' => $user->getKey(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ([$user, ...$additionalUsers] as $ownedUser) {
                DB::table('demo_dataset_users')->insert(['dataset_key' => $key, 'user_id' => $ownedUser->getKey()]);
            }

            return $files;
        });

        if ($oldFiles !== []) {
            DB::afterCommit(fn () => Storage::disk(config('autoescola.documents_disk'))->delete($oldFiles));
        }
    }

    /** @param list<int> $ownedUserIds */
    private function purge(int $organizationId, array $ownedUserIds): void
    {
        if ($ownedUserIds === []) {
            throw new RuntimeException('Marcadores de contas da demonstração ausentes; limpeza interrompida.');
        }

        $instructorIds = DB::table('instructors')->whereIn('user_id', $ownedUserIds)->pluck('id')->all();
        $externalMember = DB::table('organization_user')->where('organization_id', $organizationId)->whereNotIn('user_id', $ownedUserIds)->exists();
        $externalInstructor = DB::table('organization_instructor')->where('organization_id', $organizationId)->whereNotIn('instructor_id', $instructorIds)->exists();

        if ($externalMember || $externalInstructor
            || DB::table('organization_user')->whereIn('user_id', $ownedUserIds)->where('organization_id', '!=', $organizationId)->exists()
            || DB::table('organization_instructor')->whereIn('instructor_id', $instructorIds)->where('organization_id', '!=', $organizationId)->exists()) {
            throw new RuntimeException('A conta ou o instrutor da demonstração tem vínculo externo; limpeza interrompida.');
        }

        $tables = [
            'alerts', 'audit_events', 'invitations',
            'finance_reconciliations', 'finance_movements', 'finance_transfers', 'finance_payments',
            'finance_installments', 'finance_entries', 'finance_recurrences',
            'finance_categories', 'finance_payment_methods', 'finance_parties', 'finance_accounts',
            'external_fees', 'practical_exams', 'availability_blocks', 'vehicle_maintenances',
            'process_checklist_items', 'process_category_tracks', 'enrollment_credit_entries',
            'enrollment_packages', 'lessons', 'enrollments', 'documents', 'qualification_processes',
            'students', 'partners', 'vehicles',
        ];

        DB::table('lessons')->where('organization_id', $organizationId)->update(['registry_document_id' => null]);
        DB::table('qualification_processes')->where('organization_id', $organizationId)->update(['issuance_document_id' => null]);
        DB::table('documents')->where('organization_id', $organizationId)->update(['replaces_document_id' => null]);

        foreach ($tables as $table) {
            DB::table($table)->where('organization_id', $organizationId)->delete();
        }

        DB::table('organization_instructor')->where('organization_id', $organizationId)->delete();
        DB::table('organization_user')->where('organization_id', $organizationId)->delete();
        DB::table('organizations')->where('id', $organizationId)->delete();

        DB::table('instructors')->whereIn('id', $instructorIds)->delete();
        DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ownedUserIds)->delete();
        DB::table('sessions')->whereIn('user_id', $ownedUserIds)->delete();
        DB::table('users')->whereIn('id', $ownedUserIds)->delete();
    }
}
