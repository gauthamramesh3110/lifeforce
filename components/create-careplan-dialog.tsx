"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

interface CreateCareplanDialogProps {
    patientId: string;
    initialDescription?: string;
    onClose: () => void;
    onCreated: () => void;
}

export default function CreateCareplanDialog({
    patientId,
    initialDescription,
    onClose,
    onCreated,
}: CreateCareplanDialogProps) {
    const [descriptions, setDescriptions] = useState<string[]>([]);
    const [reasons, setReasons] = useState<string[]>([]);
    const [loadingDescriptions, setLoadingDescriptions] = useState(true);
    const [loadingReasons, setLoadingReasons] = useState(false);

    const [startDate, setStartDate] = useState("");
    const [description, setDescription] = useState(initialDescription ?? "");
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoadingDescriptions(true);
        fetch(`/api/clinical/distinct?container=careplans&field=DESCRIPTION`)
            .then((res) => (res.ok ? res.json() : []))
            .then(setDescriptions)
            .catch(() => {})
            .finally(() => setLoadingDescriptions(false));
    }, []);

    useEffect(() => {
        if (!description) {
            setReasons([]);
            setReason("");
            return;
        }
        setReason("");
        setLoadingReasons(true);
        fetch(
            `/api/clinical/distinct?container=careplans&field=REASONDESCRIPTION&filterField=DESCRIPTION&filterValue=${encodeURIComponent(description)}`
        )
            .then((res) => (res.ok ? res.json() : []))
            .then(setReasons)
            .catch(() => {})
            .finally(() => setLoadingReasons(false));
    }, [description]);

    const handleCreate = async () => {
        if (!startDate || !description) {
            setError("Start Date and Description are required.");
            return;
        }

        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch("/api/clinical", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    container: "careplans",
                    patientId,
                    record: {
                        START: startDate,
                        DESCRIPTION: description,
                        REASONDESCRIPTION: reason,
                    },
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Failed to create careplan.");
                return;
            }

            onCreated();
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Create Careplan</DialogTitle>
                    <DialogDescription>
                        Add a new careplan record for this patient.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="description">Description</Label>
                        {loadingDescriptions ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : (
                            <Select value={description} onValueChange={setDescription}>
                                <SelectTrigger id="description" className="w-full">
                                    <SelectValue placeholder="Select a description" />
                                </SelectTrigger>
                                <SelectContent>
                                    {descriptions.map((d) => (
                                        <SelectItem key={d} value={d}>
                                            {d}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="reason">Reason</Label>
                        {loadingReasons ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : (
                            <Select value={reason} onValueChange={setReason} disabled={!description}>
                                <SelectTrigger id="reason" className="w-full">
                                    <SelectValue placeholder={description ? "Select a reason" : "Select a description first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {reasons.map((r) => (
                                        <SelectItem key={r} value={r}>
                                            {r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={submitting}>
                        {submitting ? "Creating…" : "Create"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
