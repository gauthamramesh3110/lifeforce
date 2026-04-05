"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "./ui/dialog";
import CreateCareplanDialog from "./create-careplan-dialog";

export interface ClinicalColumn {
    key: string;
    label: string;
}

interface ClinicalDataTableProps {
    title: string;
    columns: ClinicalColumn[];
    records: Record<string, unknown>[];
    totalCount: number;
    containerName: string;
    patientId: string;
    dateField: string;
    showPrediction?: boolean;
}

const PAGE_SIZE = 10;

function RecordDetailDialog({
    title,
    record,
    onClose,
}: {
    title: string;
    record: Record<string, unknown>;
    onClose: () => void;
}) {
    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title} — Detail</DialogTitle>
                    <DialogDescription>Full record details</DialogDescription>
                </DialogHeader>
                <Table>
                    <TableBody>
                        {Object.entries(record)
                            .filter(([key]) => !key.startsWith("_"))
                            .map(([key, value]) => (
                                <TableRow key={key}>
                                    <TableCell className="font-medium w-1/3">{key}</TableCell>
                                    <TableCell>{String(value ?? "")}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </DialogContent>
        </Dialog>
    );
}

function ViewAllDialog({
    title,
    columns,
    containerName,
    patientId,
    dateField,
    totalCount,
    onClose,
}: {
    title: string;
    columns: ClinicalColumn[];
    containerName: string;
    patientId: string;
    dateField: string;
    totalCount: number;
    onClose: () => void;
}) {
    const [page, setPage] = useState(1);
    const [data, setData] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(false);
    const [detailRecord, setDetailRecord] = useState<Record<string, unknown> | null>(null);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    const fetchPage = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/clinical?container=${encodeURIComponent(containerName)}&patientId=${encodeURIComponent(patientId)}&dateField=${encodeURIComponent(dateField)}&page=${p}&pageSize=${PAGE_SIZE}`
            );
            if (res.ok) {
                setData(await res.json());
            }
        } catch (err) {
            console.error("Failed to fetch clinical data page:", err);
        } finally {
            setLoading(false);
        }
    }, [containerName, patientId, dateField]);

    useEffect(() => {
        fetchPage(page);
    }, [page, fetchPage]);

    return (
        <>
            <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{title} — All Records</DialogTitle>
                        <DialogDescription>
                            {totalCount} total records — Page {page} of {totalPages}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-y-auto flex-1">
                        {loading ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
                        ) : data.length === 0 ? (
                            <p className="text-sm text-gray-500 py-4 text-center">No Records</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {columns.map((col) => (
                                            <TableHead key={col.key}>{col.label}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((record, idx) => (
                                        <TableRow
                                            key={idx}
                                            className="cursor-pointer hover:bg-gray-50"
                                            onClick={() => setDetailRecord(record)}
                                        >
                                            {columns.map((col) => (
                                                <TableCell key={col.key}>
                                                    {String(record[col.key] ?? "")}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {detailRecord && (
                <RecordDetailDialog
                    title={title}
                    record={detailRecord}
                    onClose={() => setDetailRecord(null)}
                />
            )}
        </>
    );
}

export default function ClinicalDataTable({
    title,
    columns,
    records,
    totalCount,
    containerName,
    patientId,
    dateField,
    showPrediction,
}: ClinicalDataTableProps) {
    const router = useRouter();
    const [selectedRecord, setSelectedRecord] = useState<Record<
        string,
        unknown
    > | null>(null);
    const [viewAllOpen, setViewAllOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [createInitialDescription, setCreateInitialDescription] = useState<string | undefined>(undefined);
    const [prediction, setPrediction] = useState<string | null>(null);
    const [predictionLoading, setPredictionLoading] = useState(false);

    const handleCreated = () => {
        setCreateOpen(false);
        setCreateInitialDescription(undefined);
        router.refresh();
    };

    const openCreate = (initialDescription?: string) => {
        setCreateInitialDescription(initialDescription);
        setCreateOpen(true);
    };

    useEffect(() => {
        if (!showPrediction) return;
        setPredictionLoading(true);
        fetch(`/api/careplan-prediction?patientId=${encodeURIComponent(patientId)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.predicted_careplan?.description) {
                    setPrediction(data.predicted_careplan.description);
                }
            })
            .catch(() => {})
            .finally(() => setPredictionLoading(false));
    }, [showPrediction, patientId]);

    return (
        <div className="bg-white border rounded p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-semibold">{title} <span className="text-sm font-normal text-muted-foreground">({totalCount})</span></h3>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={totalCount === 0}
                        onClick={() => setViewAllOpen(true)}
                    >
                        View All
                    </Button>
                    {showPrediction && (
                        <Button variant="outline" size="sm" onClick={() => openCreate()}>
                            Create
                        </Button>
                    )}
                </div>
            </div>

            {showPrediction && (
                <div className="flex items-center justify-between mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            className="h-5 w-5 text-indigo-600 shrink-0"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                            />
                        </svg>
                        <span className="text-sm text-indigo-900">
                            {predictionLoading
                                ? "Predicting next careplan…"
                                : prediction
                                    ? <>AI Suggestion: <span className="font-semibold">{prediction}</span></>
                                    : "No prediction available"}
                        </span>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => openCreate(prediction ?? undefined)}
                        className="bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        Create Careplan
                    </Button>
                </div>
            )}
            {records.length === 0 ? (
                <p className="text-sm text-gray-500">No Records</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            {columns.map((col) => (
                                <TableHead key={col.key}>{col.label}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records.map((record, idx) => (
                            <TableRow
                                key={idx}
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => setSelectedRecord(record)}
                            >
                                {columns.map((col) => (
                                    <TableCell key={col.key}>
                                        {String(record[col.key] ?? "")}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {selectedRecord && (
                <RecordDetailDialog
                    title={title}
                    record={selectedRecord}
                    onClose={() => setSelectedRecord(null)}
                />
            )}

            {viewAllOpen && (
                <ViewAllDialog
                    title={title}
                    columns={columns}
                    containerName={containerName}
                    patientId={patientId}
                    dateField={dateField}
                    totalCount={totalCount}
                    onClose={() => setViewAllOpen(false)}
                />
            )}

            {createOpen && (
                <CreateCareplanDialog
                    patientId={patientId}
                    initialDescription={createInitialDescription}
                    onClose={() => { setCreateOpen(false); setCreateInitialDescription(undefined); }}
                    onCreated={handleCreated}
                />
            )}
        </div>
    );
}
