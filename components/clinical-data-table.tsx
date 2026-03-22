"use client";

import { useCallback, useEffect, useState } from "react";
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
}: ClinicalDataTableProps) {
    const [selectedRecord, setSelectedRecord] = useState<Record<
        string,
        unknown
    > | null>(null);
    const [viewAllOpen, setViewAllOpen] = useState(false);

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
                    <Button variant="outline" size="sm" disabled>
                        Create
                    </Button>
                </div>
            </div>
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
        </div>
    );
}
