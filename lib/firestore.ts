// lib/firestore.ts
// Helper functions for saving OD form data to Firestore.

import { db } from "@/firebase"
import { ensureAuth } from "./auth"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"

export interface SubjectPayload {
    subjectName: string
    subjectCode: string
    timeSlot: string
    facultyName: string
    facultyCode: string
    date: string
}

export interface StudentPayload {
    name: string
    semester: string
    course: string
    section: string
    enrollmentNo: string
}

export interface ODFormPayload {
    subjects: SubjectPayload[]
    students: StudentPayload[]
    timetableFileUrl?: string | null
    createdAt?: any
    mode: "single" | "multiple"
    // Optional metadata (file info, counts, status, etc.)
    [key: string]: any
}

export async function saveODForm(data: ODFormPayload) {
    await ensureAuth().catch(() => { /* ignore */ })
    const ref = collection(db, "odForms")
    const docRef = await addDoc(ref, { ...data, createdAt: serverTimestamp() })
    return docRef.id
}
