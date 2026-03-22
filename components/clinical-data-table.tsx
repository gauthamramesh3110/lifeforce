"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./ui/table";

export interface ClinicalColumn {
    key: string;
    label: string;
}

interface ClinicalDataTableProps {
    title: string;
    columns: ClinicalColumn[];
    records: Record<string, unknown>[];
}

export default function ClinicalDataTable({
    title,
    columns,
    records,
}: ClinicalDataTableProps) {
    const [selectedRecord, setSelectedRecord] = useState<Record<
        string,
        unknown
    > | null>(null);

    if (selectedRecord) {
        return (
            <div className="bg-white border rounded p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold">{title} — Detail</h3>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRecord(null)}
                    >
                        Back
                    </Button>
                </div>
                <Table>
                    <TableBody>
                        {Object.entries(selectedRecord)
                            .filter(([key]) => !key.startsWith("_"))
                            .map(([key, value]) => (
                                <TableRow key={key}>
                                    <TableCell className="font-medium">
                                        {key}
                                    </TableCell>
                                    <TableCell>{String(value ?? "")}</TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    return (
        <div className="bg-white border rounded p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-semibold">{title}</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled>
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
        </div>
    );
}
