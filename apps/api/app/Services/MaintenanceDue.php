<?php

namespace App\Services;

use App\Models\Vehicle;
use App\Models\VehicleMaintenance;
use Illuminate\Support\Collection;

/**
 * Próxima revisão por data ou quilometragem, sem telemetria: a última quilometragem conhecida é a maior
 * informada em manutenções do veículo. Vale a manutenção concluída mais recente de cada tipo.
 */
class MaintenanceDue
{
    public const SOON_DAYS = 30;

    public const SOON_KM = 1000;

    /**
     * @return Collection<int, array{maintenance: VehicleMaintenance, state: string, reasons: list<string>}>
     */
    public function forVehicle(Vehicle $vehicle, string $today): Collection
    {
        $done = VehicleMaintenance::query()
            ->where('organization_id', $vehicle->organization_id)
            ->where('vehicle_id', $vehicle->getKey())
            ->where('status', 'done')
            ->orderByDesc('performed_on')->orderByDesc('id')
            ->get();

        $latestKm = $done->max('odometer_km');

        return $done->unique('type')
            ->filter(fn (VehicleMaintenance $m) => $m->next_due_date !== null || $m->next_due_km !== null)
            ->map(function (VehicleMaintenance $m) use ($today, $latestKm) {
                $state = 'ok';
                $reasons = [];

                if ($m->next_due_date !== null) {
                    $days = (int) \Carbon\CarbonImmutable::parse($today)->diffInDays($m->next_due_date, false);
                    if ($days < 0) {
                        $state = 'overdue';
                        $reasons[] = 'date';
                    } elseif ($days <= self::SOON_DAYS) {
                        $state = $state === 'overdue' ? 'overdue' : 'due_soon';
                        $reasons[] = 'date';
                    }
                }

                if ($m->next_due_km !== null && $latestKm !== null) {
                    if ($latestKm >= $m->next_due_km) {
                        $state = 'overdue';
                        $reasons[] = 'km';
                    } elseif ($m->next_due_km - $latestKm <= self::SOON_KM) {
                        $state = $state === 'overdue' ? 'overdue' : 'due_soon';
                        $reasons[] = 'km';
                    }
                }

                return ['maintenance' => $m, 'state' => $state, 'reasons' => $reasons];
            })
            ->filter(fn (array $row) => $row['state'] !== 'ok')
            ->values();
    }
}
