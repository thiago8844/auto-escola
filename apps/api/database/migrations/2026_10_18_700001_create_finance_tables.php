<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Financeiro básico. Valores sempre em centavos (inteiros).
     *
     * - `finance_movements` é o livro-razão das contas: somente inserções. Estorno cria o movimento oposto,
     *   nunca apaga nem altera o original. Saldo = saldo inicial + entradas − saídas.
     * - Pagamento (`finance_payments`) pertence a UMA parcela; várias formas/contas = vários pagamentos.
     * - Cartão e boleto (liquidação futura) ficam `pending` e só viram dinheiro (movimento) ao serem confirmados.
     * - Lançamentos de integração (contratação, manutenção, taxa) têm `source_ref` único: nunca duplicam.
     */
    public function up(): void
    {
        Schema::create('finance_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('name', 100);
            $table->string('kind', 8);                              // bank | cash
            $table->string('institution', 100)->nullable();
            $table->string('identification', 100)->nullable();
            $table->bigInteger('opening_balance_cents')->default(0);
            $table->date('opening_date');
            $table->boolean('active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'name']);
        });

        Schema::create('finance_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('name', 80);
            $table->string('type', 8);                              // income | expense
            // Repasse/reembolso (ex.: taxa adiantada): movimenta o caixa, mas não é faturamento do serviço
            $table->boolean('is_pass_through')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'type', 'name']);
        });

        Schema::create('finance_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('name', 60);
            $table->string('kind', 10);                             // cash|pix|transfer|debit|credit|boleto|other
            $table->unsignedSmallInteger('settlement_days')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'name']);
        });

        Schema::create('finance_parties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('document', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('notes', 255)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'name']);
        });

        Schema::create('finance_recurrences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('type', 10);
            $table->string('description', 190);
            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('student_id')->nullable();
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->unsignedBigInteger('party_id')->nullable();
            $table->unsignedBigInteger('amount_cents');
            $table->unsignedTinyInteger('day_of_month');
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->boolean('active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
        });

        Schema::create('finance_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->string('type', 10);                             // receivable | payable
            $table->string('description', 190);
            $table->unsignedBigInteger('category_id');
            // Contraparte: pagador (receita) ou favorecido (despesa) — exatamente um
            $table->unsignedBigInteger('student_id')->nullable();
            $table->unsignedBigInteger('partner_id')->nullable();
            $table->unsignedBigInteger('party_id')->nullable();
            $table->unsignedBigInteger('enrollment_id')->nullable();
            $table->unsignedBigInteger('vehicle_id')->nullable();
            $table->unsignedBigInteger('maintenance_id')->nullable();
            $table->unsignedBigInteger('external_fee_id')->nullable();
            $table->unsignedBigInteger('recurrence_id')->nullable();
            $table->string('source_ref', 120)->nullable();
            $table->unsignedBigInteger('total_cents');
            $table->date('issued_on');
            $table->unsignedSmallInteger('installments_count')->default(1);
            $table->string('status', 10)->default('active');       // active | cancelled
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('cancel_reason', 255)->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'source_ref']);
            $table->index(['organization_id', 'type', 'status']);
            $table->index(['organization_id', 'student_id']);
            $table->index(['organization_id', 'enrollment_id']);
            $table->foreign(['organization_id', 'category_id'], 'entries_category_fk')->references(['organization_id', 'id'])->on('finance_categories')->restrictOnDelete();
            $table->foreign(['organization_id', 'recurrence_id'], 'entries_recurrence_fk')->references(['organization_id', 'id'])->on('finance_recurrences')->restrictOnDelete();
        });

        Schema::create('finance_installments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('entry_id');
            $table->unsignedSmallInteger('number');
            $table->date('due_date');
            $table->unsignedBigInteger('amount_cents');
            // Quanto da parcela já foi quitado (valor aplicado + desconto) pelos pagamentos não estornados
            $table->unsignedBigInteger('paid_cents')->default(0);
            $table->string('status', 10)->default('open');         // open | paid | cancelled
            $table->date('paid_on')->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->unique(['entry_id', 'number']);
            $table->index(['organization_id', 'status', 'due_date']);
            $table->foreign(['organization_id', 'entry_id'], 'installments_entry_fk')->references(['organization_id', 'id'])->on('finance_entries')->restrictOnDelete();
        });

        Schema::create('finance_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('installment_id');
            $table->unsignedBigInteger('account_id');
            $table->unsignedBigInteger('method_id');
            $table->string('status', 10);                           // pending | confirmed | reversed
            $table->date('paid_on');
            $table->date('expected_on')->nullable();                // previsão de entrada (cartão/boleto)
            $table->date('settled_on')->nullable();                 // quando o dinheiro de fato entrou/saiu
            $table->unsignedBigInteger('applied_cents');            // abate a parcela
            $table->unsignedBigInteger('discount_cents')->default(0); // abate a parcela sem movimentar caixa
            $table->unsignedBigInteger('interest_cents')->default(0); // extra recebido/pago além da parcela
            $table->unsignedBigInteger('fine_cents')->default(0);
            $table->unsignedBigInteger('fee_cents')->default(0);    // taxa de pagamento descontada da entrada
            $table->string('adjust_reason', 255)->nullable();
            $table->string('reference', 100)->nullable();
            $table->string('notes', 255)->nullable();
            $table->string('client_ref', 60)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reversed_at')->nullable();
            $table->foreignId('reversed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reverse_reason', 255)->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'client_ref']);
            $table->index(['organization_id', 'status', 'paid_on']);
            $table->index(['installment_id', 'status']);
            $table->foreign(['organization_id', 'installment_id'], 'payments_installment_fk')->references(['organization_id', 'id'])->on('finance_installments')->restrictOnDelete();
            $table->foreign(['organization_id', 'account_id'], 'payments_account_fk')->references(['organization_id', 'id'])->on('finance_accounts')->restrictOnDelete();
            $table->foreign(['organization_id', 'method_id'], 'payments_method_fk')->references(['organization_id', 'id'])->on('finance_payment_methods')->restrictOnDelete();
        });

        Schema::create('finance_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('from_account_id');
            $table->unsignedBigInteger('to_account_id');
            $table->unsignedBigInteger('amount_cents');
            $table->date('occurred_on');
            $table->string('reason', 255);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reversed_at')->nullable();
            $table->foreignId('reversed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reverse_reason', 255)->nullable();
            $table->timestamps();

            $table->unique(['organization_id', 'id']);
            $table->foreign(['organization_id', 'from_account_id'], 'transfers_from_fk')->references(['organization_id', 'id'])->on('finance_accounts')->restrictOnDelete();
            $table->foreign(['organization_id', 'to_account_id'], 'transfers_to_fk')->references(['organization_id', 'id'])->on('finance_accounts')->restrictOnDelete();
        });

        Schema::create('finance_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('account_id');
            $table->string('direction', 3);                         // in | out
            $table->unsignedBigInteger('amount_cents');
            $table->date('occurred_on');
            // payment_in | payment_out | payment_fee | transfer_in | transfer_out | adjustment | reversal
            $table->string('kind', 16);
            $table->string('description', 190);
            $table->unsignedBigInteger('payment_id')->nullable();
            $table->unsignedBigInteger('transfer_id')->nullable();
            $table->unsignedBigInteger('entry_id')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('reverses_movement_id')->nullable();
            $table->dateTime('reconciled_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['organization_id', 'account_id', 'occurred_on']);
            $table->index(['organization_id', 'occurred_on']);
            $table->index('payment_id');
            $table->index('transfer_id');
            $table->foreign(['organization_id', 'account_id'], 'movements_account_fk')->references(['organization_id', 'id'])->on('finance_accounts')->restrictOnDelete();
        });

        Schema::create('finance_reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->restrictOnDelete();
            $table->unsignedBigInteger('account_id');
            $table->date('statement_date');
            $table->bigInteger('statement_balance_cents');
            $table->bigInteger('system_balance_cents');
            $table->bigInteger('difference_cents');
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign(['organization_id', 'account_id'], 'reconciliations_account_fk')->references(['organization_id', 'id'])->on('finance_accounts')->restrictOnDelete();
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->unsignedBigInteger('finance_entry_id')->nullable()->after('practical_exam_id');
            $table->unsignedBigInteger('finance_payment_id')->nullable()->after('finance_entry_id');
            $table->index(['organization_id', 'finance_entry_id']);
            $table->index(['organization_id', 'finance_payment_id']);
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['organization_id', 'finance_entry_id']);
            $table->dropIndex(['organization_id', 'finance_payment_id']);
            $table->dropColumn(['finance_entry_id', 'finance_payment_id']);
        });
        Schema::dropIfExists('finance_reconciliations');
        Schema::dropIfExists('finance_movements');
        Schema::dropIfExists('finance_transfers');
        Schema::dropIfExists('finance_payments');
        Schema::dropIfExists('finance_installments');
        Schema::dropIfExists('finance_entries');
        Schema::dropIfExists('finance_recurrences');
        Schema::dropIfExists('finance_parties');
        Schema::dropIfExists('finance_payment_methods');
        Schema::dropIfExists('finance_categories');
        Schema::dropIfExists('finance_accounts');
    }
};
