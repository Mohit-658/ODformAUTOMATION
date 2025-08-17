"use client"

import type React from "react"

import { useState } from "react"
import { saveODForm, saveStudentData, SubjectPayload, StudentPayload } from "@/lib/firestore"
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
  const [counts, setCounts] = useState<{ subjects: number; students: number }>({ subjects: 0, students: 0 })
  const [parsedSubjects, setParsedSubjects] = useState<SubjectPayload[]>([])
  const [parsedStudents, setParsedStudents] = useState<StudentPayload[]>([])
  const [debugInfo, setDebugInfo] = useState<string | null>(null)

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
  const [perStudentMails, setPerStudentMails] = useState<{ student: StudentPayload, email: string }[]>([])
  const [toEmail, setToEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  async function parseCSV(file: File): Promise<{ subjects: SubjectPayload[]; students: StudentPayload[] }> {
    const text = await file.text()
    return new Promise((resolve, reject) => {
      const normalize = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '')
      parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim(),
        complete: (results: ParseResult<Record<string, string>>) => {
          const rows = results.data as Record<string, string>[]
          const subjects: SubjectPayload[] = []
          const students: StudentPayload[] = []
          const allHeaderKeys = new Set<string>()
          const debugRows: any[] = []
          rows.forEach((raw, idx) => {
            // Build a normalized map
            const normMap: Record<string, string> = {}
            Object.entries(raw).forEach(([k, v]) => { if (k) { const nk = normalize(k); normMap[nk] = (v || '').toString().trim(); allHeaderKeys.add(nk) } })
            const hasVals = Object.values(normMap).some(v => v)
            if (!hasVals) return
            if (idx < 3) debugRows.push(normMap) // Keep first 3 rows for debug
            const get = (...candidates: string[]) => {
              for (const c of candidates) { if (normMap[c]) return normMap[c] }
              return ''
            }
            const enrollmentNo = get('enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'enrollno', 'admno')
            let subjectCode = get('subjectcode', 'code', 'subcode', 'scode', 'subjectid', 'paperid', 'papercode', 'coursecode', 'ccode')
            const subjectName = get('subjectname', 'subject', 'subname', 'papertitle')
            const facultyName = get('facultyname', 'faculty', 'teacher', 'professor')

            // Extract student data if enrollment number exists
            if (enrollmentNo) {
              students.push({
                name: get('name', 'studentname'),
                semester: get('semester', 'sem'),
                course: get('course', 'program', 'branch'),
                section: get('section', 'sec'),
                enrollmentNo
              })
            }

            // Extract subject data if subject info exists (can be same row as student)
            if (subjectCode || (subjectName && facultyName)) {
              // If no explicit subjectCode, synthesize one
              if (!subjectCode && subjectName) {
                const maybeCode = Object.values(normMap).find(v => /[A-Za-z]{2,}\d{2,}/.test(v))
                subjectCode = maybeCode ? maybeCode.match(/[A-Za-z]{2,}\d{2,}/)![0] : subjectName.substring(0, 6).replace(/\s+/g, '').toUpperCase()
              }

              // Check if this subject already exists (avoid duplicates)
              const existingSubject = subjects.find(s => s.subjectCode === subjectCode)
              if (!existingSubject) {
                subjects.push({
                  subjectName: subjectName || 'UNKNOWN SUBJECT',
                  subjectCode: subjectCode || 'AUTO_GEN',
                  timeSlot: get('timeslot', 'slot', 'time', 'timeslotfromto'),
                  facultyName: facultyName || 'UNKNOWN FACULTY',
                  facultyCode: get('facultycode', 'fcode'),
                  date: get('date', 'day', 'sessiondate')
                })
              }
            }
          })
          setDebugInfo(`Headers: ${Array.from(allHeaderKeys).sort().join(', ')}\nFirst rows: ${JSON.stringify(debugRows, null, 2)}`)
          resolve({ subjects, students })
        },
        error: (e: any) => reject(e)
      })
    })
  }

  async function parseXLSX(file: File): Promise<{ subjects: SubjectPayload[]; students: StudentPayload[] }> {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    // Assume first sheet contains rows similar to CSV mapping logic
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const raw: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
    const normalize = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '')
    const subjects: SubjectPayload[] = []
    const students: StudentPayload[] = []
    const allHeaderKeys = new Set<string>()
    const debugRows: any[] = []
    raw.forEach((row, idx) => {
      const normMap: Record<string, string> = {}
      Object.entries(row).forEach(([k, v]) => { if (k) { const nk = normalize(k); normMap[nk] = (v || '').toString().trim(); allHeaderKeys.add(nk) } })
      const hasVals = Object.values(normMap).some(v => v)
      if (!hasVals) return
      if (idx < 3) debugRows.push(normMap) // Keep first 3 rows for debug
      const get = (...c: string[]) => { for (const kk of c) { if (normMap[kk]) return normMap[kk] } return '' }
      const enrollmentNo = get('enrollmentno', 'enrollment', 'rollno', 'rollnumber', 'enrollno', 'admno')
      let subjectCode = get('subjectcode', 'code', 'subcode', 'scode', 'subjectid', 'paperid', 'papercode', 'coursecode', 'ccode')
      const subjectName = get('subjectname', 'subject', 'subname', 'papertitle')
      const facultyName = get('facultyname', 'faculty', 'teacher', 'professor')

      // Extract student data if enrollment number exists
      if (enrollmentNo) {
        students.push({
          name: get('name', 'studentname'),
          semester: get('semester', 'sem'),
          course: get('course', 'program', 'branch'),
          section: get('section', 'sec'),
          enrollmentNo
        })
      }

      // Extract subject data if subject info exists (can be same row as student)
      if (subjectCode || (subjectName && facultyName)) {
        // If no explicit subjectCode, synthesize one
        if (!subjectCode && subjectName) {
          const maybeCode = Object.values(normMap).find(v => /[A-Za-z]{2,}\d{2,}/.test(v))
          subjectCode = maybeCode ? maybeCode.match(/[A-Za-z]{2,}\d{2,}/)![0] : subjectName.substring(0, 6).replace(/\s+/g, '').toUpperCase()
        }

        // Check if this subject already exists (avoid duplicates)
        const existingSubject = subjects.find(s => s.subjectCode === subjectCode)
        if (!existingSubject) {
          subjects.push({
            subjectName: subjectName || 'UNKNOWN SUBJECT',
            subjectCode: subjectCode || 'AUTO_GEN',
            timeSlot: get('timeslot', 'slot', 'time', 'timeslotfromto'),
            facultyName: facultyName || 'UNKNOWN FACULTY',
            facultyCode: get('facultycode', 'fcode'),
            date: get('date', 'day', 'sessiondate')
          })
        }
      }
    })
    setDebugInfo(`Headers: ${Array.from(allHeaderKeys).sort().join(', ')}\nFirst rows: ${JSON.stringify(debugRows, null, 2)}`)
    return { subjects, students }
  }

  const handleGenerateMails = async () => {
    if (!uploadedFile) {
      setSaveMsg('Upload a file first.')
      return
    }
    // Auto-detect if user forgot to pick file type
    let effectiveType = selectedFileType
    if (!effectiveType) {
      const ext = uploadedFile.name.split('.').pop()?.toLowerCase()
      if (ext === 'csv') effectiveType = 'csv'
      else if (ext === 'xlsx' || ext === 'xls') effectiveType = 'spreadsheet'
    }
    if (!effectiveType) {
      setSaveMsg('Unable to detect file type. Please choose CSV or Spreadsheet above.')
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      let subjects: SubjectPayload[] = []
      let students: StudentPayload[] = []
      if (effectiveType === 'csv') {
        const parsed = await parseCSV(uploadedFile)
        subjects = parsed.subjects
        students = parsed.students
      } else {
        const parsed = await parseXLSX(uploadedFile)
        subjects = parsed.subjects
        students = parsed.students
      }
      setParsedSubjects(subjects)
      setParsedStudents(students)
      if (!subjects.length && !students.length) {
        setSaveMsg('No rows recognized. Check headers (subjectCode, subjectName, timeSlot, facultyName, facultyCode, date, enrollmentNo, name, semester, course, section).')
        return
      }
      if (!subjects.length) {
        setSaveMsg(`Parsed 0 subjects. Ensure subject rows have a subject code column.\n${debugInfo || ''}`)
        return
      }
      if (!students.length) {
        setSaveMsg(`Parsed 0 students. Ensure student rows include enrollmentNo column.\n${debugInfo || ''}`)
        return
      }
      const id = await saveODForm({
        subjects,
        students,
        mode: 'multiple',
        timetableFileUrl: null,
        fileName: uploadedFile.name,
        counts: { subjects: subjects.length, students: students.length }
      })
      setSavedId(id)

      // Generate individual emails for each student
      const individualMails = students.map(student => ({
        student,
        email: buildPlainTextEmail(subjects, [student], { mode: 'multiple', timetableFileUrl: null })
      }))
      setPerStudentMails(individualMails)

      // Save each student's data individually to Firestore
      const studentDataPromises = individualMails.map(async (item) => {
        return await saveStudentData({
          student: item.student,
          subjects: subjects,
          email: item.email,
          parentFormId: id,
          fileName: uploadedFile.name
        })
      })

      const studentDataIds = await Promise.all(studentDataPromises)
      setSaveMsg(`Saved bulk entry (ID: ${id}) with ${students.length} individual student records. Subjects: ${subjects.length}, Students: ${students.length}`)
      setCounts({ subjects: subjects.length, students: students.length })

      // Show a combined mail similar to single form style (all students together)
      const combined = buildPlainTextEmail(subjects, students, { mode: 'multiple', timetableFileUrl: null })
      setGeneratedMail(combined)
    } catch (e: any) {
      console.error('Bulk parse/save failed', e)
      if (e?.code === 'permission-denied') setSaveMsg('Permission denied: update Firestore rules.')
      else setSaveMsg(e.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  const handleCopy = async (text: string, index?: number) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    if (index !== undefined) {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } else {
      setSendResult('Copied to clipboard')
      setTimeout(() => setSendResult(null), 2000)
    }
  }

  const handleSendIndividual = async (emailContent: string, recipientEmail: string, index: number) => {
    if (!savedId) {
      setSendResult('Save form first');
      return
    }
    setSending(true)
    setSendResult(`Sending to ${recipientEmail}...`)
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: savedId,
          to: recipientEmail,
          customContent: emailContent
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed sending email')
      setSendResult(`Email sent successfully to ${recipientEmail}`)
      setTimeout(() => setSendResult(null), 3000)
    } catch (e: any) {
      setSendResult(`Failed to send to ${recipientEmail}: ${e.message}`)
      setTimeout(() => setSendResult(null), 5000)
    } finally {
      setSending(false)
    }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-teal-50 relative overflow-hidden">
      {/* Header with Logo and Back Button */}
      <div className="p-6 md:p-10">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2 rounded-full px-6 bg-transparent order-2 md:order-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <img src="/images/acc-logo.png" alt="Amity Coding Club Logo" className="w-16 h-16 object-contain drop-shadow" />
          <div>
            <h1 className="text-2xl md:text-3xl font-grandiflora text-black leading-tight">Multiple OD Entry</h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center px-6 md:px-10 pt-2 pb-40">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-grandiflora text-black mb-3">Bulk Upload</h2>
          <p className="text-base md:text-lg font-jura text-gray-600 max-w-xl">Supported formats: CSV (.csv) or Spreadsheet (.xlsx). Include rows for subjects & students; they'll be auto-detected.</p>
        </div>

        {/* Upload Card */}
        <Card className="w-full max-w-3xl p-6 md:p-10 shadow-lg bg-white/80 backdrop-blur rounded-3xl relative z-10 border border-teal-100">
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
              <div className="border-2 border-dashed border-teal-200 rounded-xl p-8 text-center hover:border-teal-400 transition-colors bg-teal-50/30">
                <Upload className="w-12 h-12 text-teal-400 mx-auto mb-4" />
                <div className="space-y-3">
                  <p className="text-gray-600 font-jura text-sm">
                    {uploadedFile ? <span className="text-teal-700 font-medium">{uploadedFile.name}</span> : "Drag & drop or click to browse"}
                  </p>
                  <input
                    type="file"
                    accept={selectedFileType === "csv" ? ".csv" : ".csv,.xlsx,.xls"}
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Label
                    htmlFor="file-upload"
                    className="inline-block bg-white/80 hover:bg-white text-teal-700 border border-teal-300 px-4 py-2 rounded-full cursor-pointer transition-colors shadow"
                  >
                    {uploadedFile ? 'Change File' : 'Choose File'}
                  </Label>
                </div>
              </div>
            </div>

            {/* Generate Mails Button */}
            <div className="flex justify-center pt-2">
              <div className="flex flex-col items-center gap-2">
                <Button
                  onClick={handleGenerateMails}
                  disabled={!uploadedFile || saving}
                  className="bg-gradient-to-r from-black to-teal-700 text-white hover:from-black hover:to-teal-600 rounded-full px-10 py-3 font-jura text-lg shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "Generate Mails"}
                </Button>
                {saveMsg && <p className="text-xs text-gray-600 whitespace-pre-line">{saveMsg}</p>}
              </div>
            </div>
            {generatedMail && (
              <Card className="p-6 md:p-8 space-y-5 mt-10 bg-white/90 backdrop-blur border border-teal-100 shadow">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-black">Combined Email (All Students)</h2>
                  <span className="text-xs text-gray-500">Master email for all students</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block mb-2">To (Recipient Email)</Label>
                    <input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="coordinator@example.com" className="border rounded-md w-full p-2 text-sm" />
                  </div>
                </div>
                <textarea
                  readOnly
                  value={generatedMail}
                  className="w-full h-72 text-xs md:text-sm font-mono p-3 border rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <div className="flex gap-3 flex-wrap">
                  <Button type="button" variant="outline" onClick={() => handleCopy(generatedMail)} className="rounded-full">Copy Combined Email</Button>
                  <Button type="button" onClick={handleSend} disabled={sending} className="rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow">
                    {sending ? 'Sending...' : 'Send Combined Email'}
                  </Button>
                </div>
                {sendResult && <p className="text-sm text-gray-600">{sendResult}</p>}
              </Card>
            )}

            {/* Individual Student Emails */}
            {perStudentMails.length > 0 && (
              <Card className="p-6 md:p-8 space-y-5 mt-6 bg-white/90 backdrop-blur border border-teal-100 shadow">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-black">Individual Student Emails ({perStudentMails.length})</h2>
                  <span className="text-xs text-gray-500">One email per student</span>
                </div>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {perStudentMails.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-800">{item.student.name}</h3>
                          <p className="text-sm text-gray-600">
                            {item.student.enrollmentNo} • {item.student.course} • Sem {item.student.semester}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(item.email, index)}
                            className="rounded-full text-xs"
                          >
                            {copiedIndex === index ? 'Copied!' : 'Copy'}
                          </Button>
                        </div>
                      </div>
                      <div className="mb-3">
                        <Label className="block mb-1 text-sm">Send to:</Label>
                        <input
                          type="email"
                          placeholder={`${item.student.enrollmentNo}@student.amity.edu`}
                          className="border rounded-md w-full p-2 text-sm"
                          id={`email-${index}`}
                        />
                      </div>
                      <details className="group">
                        <summary className="cursor-pointer select-none text-teal-700 text-sm mb-2 group-open:mb-3">
                          Preview Email Content
                        </summary>
                        <textarea
                          readOnly
                          value={item.email}
                          className="w-full h-32 text-xs font-mono p-3 border rounded-md bg-white focus:outline-none"
                        />
                      </details>
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const emailInput = document.getElementById(`email-${index}`) as HTMLInputElement
                            const recipientEmail = emailInput?.value || `${item.student.enrollmentNo}@student.amity.edu`
                            handleSendIndividual(item.email, recipientEmail, index)
                          }}
                          disabled={sending}
                          className="rounded-full bg-teal-600 hover:bg-teal-700 text-white text-xs"
                        >
                          Send Email
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
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
