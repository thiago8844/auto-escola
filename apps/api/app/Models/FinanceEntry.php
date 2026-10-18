<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Lançamento a receber ou a pagar. `source_ref` único evita duplicar integrações.
 */
#[Fillable(['organization_id','type','description','category_id','student_id','partner_id','party_id','enrollment_id','vehicle_id','maintenance_id','external_fee_id','recurrence_id','source_ref','total_cents','issued_on','installments_count','status','notes','created_by','cancelled_at','cancelled_by','cancel_reason'])]
class FinanceEntry extends Model
{
    protected $attributes = ['status'=>'active','installments_count'=>1];

    protected function casts(): array
    {
        return ['issued_on'=>'date','cancelled_at'=>'datetime','total_cents'=>'integer'];
    }

    public function installments(): HasMany
    {
        return $this->hasMany(FinanceInstallment::class, 'entry_id')->orderBy('number');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinanceCategory::class, 'category_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class)->withTrashed();
    }

    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class)->withTrashed();
    }

    public function party(): BelongsTo
    {
        return $this->belongsTo(FinanceParty::class, 'party_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isReceivable(): bool
    {
        return $this->type === 'receivable';
    }
}
