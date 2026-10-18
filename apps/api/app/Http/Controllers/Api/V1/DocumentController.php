<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Documents\StoreDocument;
use App\Enums\DocumentStatus;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Documents\ListDocumentsRequest;
use App\Http\Requests\Documents\StoreDocumentRequest;
use App\Http\Requests\Documents\UpdateDocumentRequest;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Models\Organization;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function index(ListDocumentsRequest $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Document::class, $organization]);

        $documents = $organization->documents()
            ->when($request->filled('student_id'), fn ($q) => $q->where('student_id', $request->integer('student_id')))
            ->when($request->filled('qualification_process_id'), fn ($q) => $q->where('qualification_process_id', $request->integer('qualification_process_id')))
            ->when($request->filled('vehicle_id'), fn ($q) => $q->where('vehicle_id', $request->integer('vehicle_id')))
            ->when($request->filled('practical_exam_id'), fn ($q) => $q->where('practical_exam_id', $request->integer('practical_exam_id')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return DocumentResource::collection($documents);
    }

    public function store(StoreDocumentRequest $request, Organization $organization, StoreDocument $store): JsonResponse
    {
        $this->authorize('create', [Document::class, $organization]);

        $document = $store($organization, $request->user(), $request->file('file'), $request->metadata());

        return (new DocumentResource($document->refresh()))->response()->setStatusCode(201);
    }

    public function show(Organization $organization, Document $document): JsonResponse
    {
        $this->authorize('view', [$document, $organization]);

        return (new DocumentResource($document))->response();
    }

    /**
     * Conferência interna e metadados. `verified` registra quem conferiu e quando; não prova autenticidade.
     */
    public function update(UpdateDocumentRequest $request, Organization $organization, Document $document, Audit $audit): JsonResponse
    {
        $this->authorize('update', [$document, $organization]);

        $data = $request->validated();

        if (isset($data['status'])) {
            if ($document->status === DocumentStatus::Replaced) {
                throw new BusinessRuleException(
                    'Documentos substituídos não podem ser alterados.',
                    'document_replaced',
                    422,
                );
            }

            $verified = $data['status'] === DocumentStatus::Verified->value;
            $data['verified_by'] = $verified ? $request->user()->getKey() : null;
            $data['verified_at'] = $verified ? now() : null;
        }

        $document->update($data);

        if (isset($data['status'])) {
            $audit->record($organization->getKey(), 'document.'.$data['status'], "Documento {$document->type->value}: situação {$data['status']}.", [
                'student_id' => $document->student_id,
                'process_id' => $document->qualification_process_id,
                'subject' => $document,
            ]);
        }

        return (new DocumentResource($document->refresh()))->response();
    }

    public function download(Organization $organization, Document $document): StreamedResponse
    {
        $this->authorize('view', [$document, $organization]);

        return Storage::disk(config('autoescola.documents_disk'))
            ->download($document->storage_path, $document->original_name, ['X-Content-Type-Options' => 'nosniff']);
    }
}
