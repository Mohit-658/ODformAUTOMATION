"use client"

import type React from "react"

import { useState } from "react"
import { saveODForm, SubjectPayload, StudentPayload } from "@/lib/firestore"
import { buildPlainTextEmail } from "@/lib/email-builder"
import { parse, ParseResult, ParseError } from "papaparse"
import * as XLSX from 'xlsx'
import { ArrowLeft, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

interface MultipleEntryProps {
  onBack: () => void
}

export function MultipleEntry({ onBack }: MultipleEntryProps) {
  const [selectedFileType, setSelectedFileType] = useState<"spreadsheet" | "csv" | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [generatedMail, setGeneratedMail] = useState("")
  const [toEmail, setToEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  async function parseCSV(file: File): Promise<{ subjects: SubjectPayload[]; students: StudentPayload[] }> {
    const text = await file.text()
    return new Promise((resolve, reject) => {
      parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results: ParseResult<Record<string, string>>) => {
          const rows = results.data as Record<string, string>[]
          // Heuristic: subjects vs students separated by row type column or presence of enrollmentNo
          const subjects: SubjectPayload[] = []
          const students: StudentPayload[] = []
          rows.forEach((r) => {
            if (r.enrollmentNo || r.enrollment || r.EnrollmentNo) {
              students.push({
                name: r.name || r.Name || "",
                semester: r.semester || r.Semester || "",
                course: r.course || r.Course || "",
                section: r.section || r.Section || "",
                enrollmentNo: r.enrollmentNo || r.enrollment || r.EnrollmentNo || "",
              })
            } else if (r.subjectCode || r.SubjectCode) {
              subjects.push({
                subjectName: r.subjectName || r.SubjectName || r.subject || "",
                subjectCode: r.subjectCode || r.SubjectCode || "",
                timeSlot: r.timeSlot || r.TimeSlot || r.slot || "",
                facultyName: r.facultyName || r.FacultyName || r.faculty || "",
                facultyCode: r.facultyCode || r.FacultyCode || "",
                date: r.date || r.Date || "",
              })
            }
          })
          resolve({ subjects, students })
        },
        error: (error: any) => reject(error),
      })
    })
  }

  async function parseXLSX(file: File): Promise<{ subjects: SubjectPayload[]; students: StudentPayload[] }> {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    // Assume first sheet contains rows similar to CSV mapping logic
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const subjects: SubjectPayload[] = []
    const students: StudentPayload[] = []
    json.forEach(r => {
      if (r.enrollmentNo || r.enrollment || r.EnrollmentNo) {
        students.push({
          name: r.name || r.Name || '',
          semester: r.semester || r.Semester || '',
          course: r.course || r.Course || '',
          section: r.section || r.Section || '',
          enrollmentNo: r.enrollmentNo || r.enrollment || r.EnrollmentNo || ''
        })
      } else if (r.subjectCode || r.SubjectCode) {
        subjects.push({
          subjectName: r.subjectName || r.SubjectName || r.subject || '',
          subjectCode: r.subjectCode || r.SubjectCode || '',
          timeSlot: r.timeSlot || r.TimeSlot || r.slot || '',
          facultyName: r.facultyName || r.FacultyName || r.faculty || '',
          facultyCode: r.facultyCode || r.FacultyCode || '',
          date: r.date || r.Date || ''
        })
      }
    })
    return { subjects, students }
  }

  const handleGenerateMails = async () => {
    if (!uploadedFile) {
      alert("Please upload a file first")
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      let subjects: SubjectPayload[] = []
      let students: StudentPayload[] = []
      if (selectedFileType === "csv") {
        const parsed = await parseCSV(uploadedFile)
        subjects = parsed.subjects
        students = parsed.students
      } else if (selectedFileType === 'spreadsheet') {
        const parsed = await parseXLSX(uploadedFile)
        subjects = parsed.subjects
        students = parsed.students
      }
      const id = await saveODForm({
        subjects,
        students,
        mode: "multiple",
        timetableFileUrl: null,
        fileName: uploadedFile.name,
        counts: { subjects: subjects.length, students: students.length },
      })
      setSavedId(id)
      setSaveMsg(`Saved bulk entry (ID: ${id}) Subjects: ${subjects.length}, Students: ${students.length}`)
      // Build one email per student referencing all subjects
      const emails = students.map(st =>
        buildPlainTextEmail(subjects, [st], { mode: 'multiple', timetableFileUrl: null })
      )
      setGeneratedMail(emails.join('\n\n---\n\n'))
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        setSaveMsg('Permission denied: update Firestore rules.')
      } else {
        setSaveMsg(e.message || "Failed to save")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedMail) return
    await navigator.clipboard.writeText(generatedMail)
    setSendResult('Copied to clipboard')
    setTimeout(() => setSendResult(null), 2000)
  }

  const handleSend = async () => {
    if (!savedId) { setSendResult('Save form first'); return }
    if (!toEmail) { setSendResult('Provide recipient email domain or base (use {enrollmentNo}@domain if pattern)'); return }
    setSending(true)
    setSendResult('Sending...')
    try {
      // Attempt to detect delimiter for multiple emails (comma / newline)
      const targets = toEmail.split(/[,\n]/).map(t => t.trim()).filter(Boolean)
      if (targets.length === 1 && targets[0].includes('{')) {
        // Pattern mode e.g. {enrollmentNo}@example.com -> will expand per student stored in generatedMail sections
        // We don't have student list here directly; rely on original parsing kept via closure (not stored). Simplification: user provides explicit list.
      }
      let sent = 0
      for (const t of targets) {
        const res = await fetch('/api/generate-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: savedId, to: t })
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed sending to ' + t)
        sent++
        setSendResult(`Sent ${sent}/${targets.length}`)
      }
      setSendResult(`All ${sent} emails sent successfully`)
    } catch (e: any) {
      setSendResult(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 relative overflow-hidden">
      {/* Header with Logo and Back Button */}
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/acc-logo.png" alt="Amity Coding Club Logo" className="w-20 h-20 object-contain" />
          </div>
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2 rounded-full px-6 bg-transparent"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-8 pt-2 pb-32">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-grandiflora text-black mb-4">Multiple Entry</h2>
          <p className="text-xl font-grandiflora text-black">Upload your file to generate mails </p>
        </div>

        {/* Upload Card */}
        <Card className="w-full max-w-2xl p-8 shadow-lg bg-white rounded-3xl relative z-10">
          <div className="space-y-6">
            {/* File Type Selection */}
            <div>
              <Label className="text-lg font-medium text-gray-700 mb-3 block">Choose File Type</Label>
              <div className="flex gap-4">
                <Button
                  variant={selectedFileType === "spreadsheet" ? "default" : "outline"}
                  className={`flex-1 rounded-full py-3 font-jura ${selectedFileType === "spreadsheet"
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  onClick={() => setSelectedFileType("spreadsheet")}
                >
                  Spreadsheet (.xlsx)
                </Button>
                <Button
                  variant={selectedFileType === "csv" ? "default" : "outline"}
                  className={`flex-1 rounded-full py-3 font-jura ${selectedFileType === "csv"
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  onClick={() => setSelectedFileType("csv")}
                >
                  CSV (.csv)
                </Button>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <Label className="text-lg font-medium text-gray-700 mb-3 block">Upload File</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-teal-500 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-gray-600">
                    {uploadedFile ? uploadedFile.name : "Drag and drop your file here, or click to browse"}
                  </p>
                  <input
                    type="file"
                    accept={selectedFileType === "csv" ? ".csv" : ".xlsx,.xls"}
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label
                    htmlFor="file-upload"
                    className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    Choose File
                  </Label>
                </div>
              </div>
            </div>

            {/* Generate Mails Button */}
            <div className="flex justify-center pt-4">
              <div className="flex flex-col items-center gap-2">
                <Button
                  onClick={handleGenerateMails}
                  disabled={!uploadedFile || saving}
                  className="bg-black text-white hover:bg-black/90 rounded-full px-8 py-3 font-jura text-lg"
                >
                  {saving ? "Saving..." : "Generate Mails"}
                </Button>
                {saveMsg && <p className="text-xs text-gray-600">{saveMsg}</p>}
              </div>
            </div>
            {generatedMail && (
              <Card className="p-6 space-y-4 mt-6">
                <h2 className="text-xl font-semibold text-black">Generated Mail</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block mb-2">To (Recipient Email)</Label>
                    <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="recipient@example.com" className="border rounded-md w-full p-2 text-sm" />
                  </div>
                </div>
                <textarea
                  readOnly
                  value={generatedMail}
                  className="w-full h-64 text-sm font-mono p-3 border rounded-md bg-gray-50"
                />
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={handleCopy} className="rounded-full">Copy</Button>
                  <Button type="button" onClick={handleSend} disabled={sending} className="rounded-full bg-teal-600 hover:bg-teal-700 text-white">
                    {sending ? 'Sending...' : 'Send All Emails'}
                  </Button>
                </div>
                {sendResult && <p className="text-sm text-gray-600">{sendResult}</p>}
              </Card>
            )}
          </div>
        </Card>
      </div>

      {/* Decorative Wave */}
      <div className="absolute bottom-0 left-0 right-0 z-0">
        <svg viewBox="0 0 1440 320" className="w-full h-auto" preserveAspectRatio="none">
          <path
            fill="#14b8a6"
            fillOpacity="1"
            d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,149.3C672,149,768,203,864,208C960,213,1056,171,1152,149.3C1248,128,1344,128,1392,128L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </svg>
      </div>
    </div>
  )
}
