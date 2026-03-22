import PatientDetails from "@/components/patient-details";
import ClinicalDataTable, { ClinicalColumn } from "@/components/clinical-data-table";
import { CosmosClient } from "@azure/cosmos";

const client = new CosmosClient({
    endpoint: process.env.COSMOS_DB_ENDPOINT!,
    key: process.env.COSMOS_DB_KEY!,
});

const db = client.database("clinical");

interface ClinicalSection {
    title: string;
    container: string;
    dateField: string;
    columns: ClinicalColumn[];
}

const clinicalSections: ClinicalSection[] = [
    {
        title: "Allergies",
        container: "allergies",
        dateField: "START",
        columns: [
            { key: "START", label: "Date" },
            { key: "DESCRIPTION", label: "Description" },
            { key: "CATEGORY", label: "Category" },
            { key: "SEVERITY1", label: "Severity" },
        ],
    },
    {
        title: "Careplans",
        container: "careplans",
        dateField: "START",
        columns: [
            { key: "START", label: "Start" },
            { key: "DESCRIPTION", label: "Description" },
            { key: "REASONDESCRIPTION", label: "Reason" },
        ],
    },
    {
        title: "Conditions",
        container: "conditions",
        dateField: "START",
        columns: [
            { key: "START", label: "Start" },
            { key: "DESCRIPTION", label: "Description" },
        ],
    },
    {
        title: "Immunizations",
        container: "immunizations",
        dateField: "DATE",
        columns: [
            { key: "DATE", label: "Date" },
            { key: "DESCRIPTION", label: "Description" },
        ],
    },
    {
        title: "Medications",
        container: "medications",
        dateField: "START",
        columns: [
            { key: "START", label: "Start" },
            { key: "DESCRIPTION", label: "Description" },
            { key: "TOTALCOST", label: "Total Cost" },
        ],
    },
    {
        title: "Observations",
        container: "observations",
        dateField: "DATE",
        columns: [
            { key: "DATE", label: "Date" },
            { key: "DESCRIPTION", label: "Description" },
            { key: "VALUE", label: "Value" },
            { key: "UNITS", label: "Units" },
        ],
    },
    {
        title: "Procedures",
        container: "procedures",
        dateField: "START",
        columns: [
            { key: "START", label: "Start" },
            { key: "DESCRIPTION", label: "Description" },
            { key: "REASONDESCRIPTION", label: "Reason" },
        ],
    },
];

async function fetchTop3WithCount(containerName: string, dateField: string, patientId: string) {
    const container = db.container(containerName);
    const [top3Result, countResult] = await Promise.all([
        container.items
            .query({
                query: `SELECT TOP 3 * FROM c WHERE c.PATIENT = @patientId ORDER BY c["${dateField}"] DESC`,
                parameters: [{ name: "@patientId", value: patientId }],
            })
            .fetchAll(),
        container.items
            .query({
                query: `SELECT VALUE COUNT(1) FROM c WHERE c.PATIENT = @patientId`,
                parameters: [{ name: "@patientId", value: patientId }],
            })
            .fetchAll(),
    ]);
    return { records: top3Result.resources, totalCount: countResult.resources[0] ?? 0 };
}

export default async function PatientDetailsPage({ params }: { params: { id: string } }) {
    const { id } = await params;

    const container = db.container("patients");
    const { resources } = await container.items
        .query({
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: id }],
        })
        .fetchAll();

    if (resources.length === 0) {
        return <div className="p-4">Patient not found</div>;
    }

    const patient = resources[0];

    const clinicalData = await Promise.all(
        clinicalSections.map((section) =>
            fetchTop3WithCount(section.container, section.dateField, id)
        )
    );

    return (
        <div className="p-4 flex flex-row gap-0">
            <div className="p-4 w-1/3 border-r">
                <h2 className="text-xl font-bold mb-4">Patient Details</h2>
                <PatientDetails patient={patient} />
            </div>
            <div className="p-4 w-2/3 flex flex-col gap-4">
                <h2 className="text-xl font-bold">Clinical Details</h2>
                {clinicalSections.map((section, idx) => (
                    <ClinicalDataTable
                        key={section.container}
                        title={section.title}
                        columns={section.columns}
                        records={clinicalData[idx].records}
                        totalCount={clinicalData[idx].totalCount}
                        containerName={section.container}
                        patientId={id}
                        dateField={section.dateField}
                    />
                ))}
            </div>
        </div>
    );
}