"use client"

import { useState } from "react"
import { saveODForm } from "@/lib/firestore"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Minus, ArrowLeft } from "lucide-react"
import { buildPlainTextEmail } from "@/lib/email-builder"

interface Student {
  id: string
  name: string
  semester: string
  course: string
  section: string
  enrollmentNo: string
}

interface Subject {
  id: string
  subjectName: string
  subjectCode: string
  timeSlot: string
  facultyName: string
  facultyCode: string
  date: string
}

interface ODFormProps { onBack: () => void }

export function ODForm({ onBack }: ODFormProps) {
  const [numberOfSubjects, setNumberOfSubjects] = useState(1)
  const [subjects, setSubjects] = useState<Subject[]>([
    { id: "1", subjectName: "", subjectCode: "", timeSlot: "", facultyName: "", facultyCode: "", date: "" }
  ])
  const [students, setStudents] = useState<Student[]>([
    { id: "1", name: "", semester: "", course: "", section: "", enrollmentNo: "" }
  ])

  const handleSubjectCountChange = (count: number) => {
    setNumberOfSubjects(count)
    const newSubjects = Array.from({ length: count }, (_, index) => ({
      id: (index + 1).toString(),
      subjectName: subjects[index]?.subjectName || "",
      subjectCode: subjects[index]?.subjectCode || "",
      timeSlot: subjects[index]?.timeSlot || "",
      facultyName: subjects[index]?.facultyName || "",
      facultyCode: subjects[index]?.facultyCode || "",
      date: subjects[index]?.date || "",
    }))
    setSubjects(newSubjects)
  }

  const updateSubject = (id: string, field: keyof Subject, value: string) => {
    setSubjects(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const addStudent = () => {
    setStudents(prev => [...prev, { id: (prev.length + 1).toString(), name: "", semester: "", course: "", section: "", enrollmentNo: "" }])
  }

  const removeStudent = (id: string) => {
    if (students.length > 1) setStudents(prev => prev.filter(s => s.id !== id))
  }

  const updateStudent = (id: string, field: keyof Student, value: string) => {
    setStudents(prev => prev.map(st => st.id === id ? { ...st, [field]: value } : st))
  }

  // Timetable upload removed

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [toEmail, setToEmail] = useState("")
  const [generatedMail, setGeneratedMail] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  // Progress & completeness
  const subjectsCompleteCount = subjects.filter(s => s.subjectName && s.subjectCode && s.timeSlot && s.facultyName && s.facultyCode && s.date).length
  const studentsCompleteCount = students.filter(s => s.name && s.semester && s.course && s.section && s.enrollmentNo).length
  const subjectProgress = Math.round((subjectsCompleteCount / subjects.length) * 100)
  const studentProgress = Math.round((studentsCompleteCount / students.length) * 100)
  const isSubjectsComplete = subjectsCompleteCount === subjects.length
  const isStudentsComplete = studentsCompleteCount === students.length
  const isFormComplete = isSubjectsComplete && isStudentsComplete

  const handleSubmit = async () => {
    setSaving(true); setSaveError(null); setSavedId(null)
    try {
      const timetableFileUrl: string | null = null
      const id = await saveODForm({
        subjects: subjects.map(({ id, ...rest }) => rest),
        students: students.map(({ id, ...rest }) => rest),
        timetableFileUrl,
        mode: 'single'
      })
      setSavedId(id)
      const mail = buildPlainTextEmail(
        subjects.map(({ id, ...r }) => r),
        students.map(({ id, ...r }) => r),
        { mode: 'single', timetableFileUrl }
      )
      setGeneratedMail(mail)
    } catch (e: any) {
      setSaveError(e?.code === 'permission-denied' ? 'Permission denied: check Firestore security rules.' : (e.message || 'Failed to save form'))
    } finally { setSaving(false) }
  }

  const handleCopy = async () => {
    if (!generatedMail) return; await navigator.clipboard.writeText(generatedMail); setSendResult('Copied to clipboard'); setTimeout(() => setSendResult(null), 2000)
  }

  const handleSend = async () => {
    if (!savedId) { setSendResult('Save form first'); return }
    if (!toEmail) { setSendResult('Provide recipient email'); return }
    setSending(true); setSendResult(null)
    try {
      const res = await fetch('/api/generate-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: savedId, to: toEmail }) })
      const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Failed')
      setSendResult('Email sent (ID: ' + json.messageId + ')')
    } catch (e: any) { setSendResult(e.message) } finally { setSending(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-white to-teal-50 p-6 md:p-10">
      {/* Header & Progress */}
      <div className="flex items-center gap-4 mb-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-gray-200 border"><ArrowLeft className="w-5 h-5" /></Button>
        <img src="/images/acc-logo.png" alt="Amity Coding Club Logo" className="w-14 h-14 object-contain drop-shadow" />
        <div>
          <h1 className="text-2xl md:text-3xl font-grandiflora text-black leading-tight">Single OD Entry</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-10">
        {/* Subjects Section */}
        <Card className="p-6 md:p-8 shadow-lg border-teal-100 bg-white/80 backdrop-blur">
          <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-black">Subject Details</h2>
              <p className="text-xs text-gray-500 mt-1">Provide subject & faculty info for each subject</p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs font-medium">Subjects</Label>
              <Select value={numberOfSubjects.toString()} onValueChange={v => handleSubjectCountChange(parseInt(v))}>
                <SelectTrigger className="w-32 h-9 text-sm"><SelectValue placeholder="Count" /></SelectTrigger>
                <SelectContent>{Array.from({ length: 8 }, (_, i) => (<SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-6">
            {subjects.map((subject, i) => (
              <Card key={subject.id} className="p-4 border border-teal-100 bg-teal-50/30">
                <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm tracking-wide uppercase text-teal-700">Subject {i + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><Label htmlFor={`sname-${subject.id}`} className="block mb-2">Subject Name</Label><Input id={`sname-${subject.id}`} value={subject.subjectName} onChange={e => updateSubject(subject.id, 'subjectName', e.target.value)} placeholder="Enter subject name" /></div>
                  <div><Label htmlFor={`scode-${subject.id}`} className="block mb-2">Subject Code</Label><Input id={`scode-${subject.id}`} value={subject.subjectCode} onChange={e => updateSubject(subject.id, 'subjectCode', e.target.value)} placeholder="Enter subject code" /></div>
                  <div><Label className="block mb-2">Time Slot</Label><Select value={subject.timeSlot} onValueChange={v => updateSubject(subject.id, 'timeSlot', v)}><SelectTrigger><SelectValue placeholder="Choose time" /></SelectTrigger><SelectContent>{['09:15 AM - 10:10 AM', '10:15 AM - 11:10 AM', '11:15 AM - 12:10 PM', '12:15 PM - 01:10 PM', '01:15 PM - 02:10 PM', '02:15 PM - 03:10 PM', '03:15 PM - 04:10 PM', '04:15 PM - 05:10 PM'].map(slot => (<SelectItem key={slot} value={slot}>{slot}</SelectItem>))}</SelectContent></Select></div>
                  <div><Label htmlFor={`fname-${subject.id}`} className="block mb-2">Faculty Name</Label><Input id={`fname-${subject.id}`} value={subject.facultyName} onChange={e => updateSubject(subject.id, 'facultyName', e.target.value)} placeholder="Enter faculty name" /></div>
                  <div><Label htmlFor={`fcode-${subject.id}`} className="block mb-2">Faculty Code</Label><Input id={`fcode-${subject.id}`} value={subject.facultyCode} onChange={e => updateSubject(subject.id, 'facultyCode', e.target.value)} placeholder="Enter faculty code" /></div>
                  <div><Label htmlFor={`date-${subject.id}`} className="block mb-2">Date</Label><Input id={`date-${subject.id}`} type="date" value={subject.date} onChange={e => updateSubject(subject.id, 'date', e.target.value)} /></div>
                </div>
              </Card>
            ))}
          </div>
          {/* Timetable upload removed */}
        </Card>

        {/* Students Section */}
        <Card className="p-6 md:p-8 shadow-lg border-teal-100 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-xl font-semibold text-black">Student Details</h2><p className="text-xs text-gray-500 mt-1">List each participating student</p></div>
            <Button onClick={addStudent} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 rounded-full"><Plus className="w-4 h-4" />Add Student</Button>
          </div>
          <div className="space-y-6">
            {students.map((student, i) => (
              <Card key={student.id} className="p-4 bg-teal-50/30 border border-teal-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Student {i + 1}</h3>
                  {students.length > 1 && <Button variant="ghost" size="sm" onClick={() => removeStudent(student.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"><Minus className="w-4 h-4" /></Button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><Label htmlFor={`name-${student.id}`} className="block mb-2">Name</Label><Input id={`name-${student.id}`} value={student.name} onChange={e => updateStudent(student.id, 'name', e.target.value)} placeholder="Enter name" /></div>
                  <div><Label htmlFor={`sem-${student.id}`} className="block mb-2">Semester</Label><Input id={`sem-${student.id}`} value={student.semester} onChange={e => updateStudent(student.id, 'semester', e.target.value)} placeholder="Enter semester" /></div>
                  <div><Label htmlFor={`course-${student.id}`} className="block mb-2">Course</Label><Input id={`course-${student.id}`} value={student.course} onChange={e => updateStudent(student.id, 'course', e.target.value)} placeholder="Enter course" /></div>
                  <div><Label htmlFor={`section-${student.id}`} className="block mb-2">Section</Label><Input id={`section-${student.id}`} value={student.section} onChange={e => updateStudent(student.id, 'section', e.target.value)} placeholder="Enter section" /></div>
                  <div className="md:col-span-2"><Label htmlFor={`enroll-${student.id}`} className="block mb-2">Enrollment No</Label><Input id={`enroll-${student.id}`} value={student.enrollmentNo} onChange={e => updateStudent(student.id, 'enrollmentNo', e.target.value)} placeholder="Enter enrollment number" /></div>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* Submit / Generate */}
        <div className="flex flex-col items-center gap-4">
          <Button onClick={handleSubmit} disabled={saving || !isFormComplete} className="px-10 py-3 bg-gradient-to-r from-black to-teal-700 text-white hover:from-black hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-jura shadow">{saving ? 'Saving...' : 'Generate Mail'}</Button>
          {!isFormComplete && <p className="text-xs text-gray-500">Fill all subject & student fields to enable.</p>}
          {savedId && <p className="text-sm text-green-600">Saved (ID: {savedId})</p>}
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </div>

        {generatedMail && (
          <Card className="p-6 md:p-8 space-y-5 shadow-lg border-teal-100 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between"><h2 className="text-xl font-semibold text-black">Generated Mail</h2><span className="text-xs text-gray-500">Review & send</span></div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label className="block mb-2">To (Recipient Email)</Label><Input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="recipient@example.com" /></div>
            </div>
            <textarea readOnly value={generatedMail} className="w-full h-64 text-xs md:text-sm font-mono p-3 border rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            <div className="flex gap-3 flex-wrap">
              <Button type="button" variant="outline" onClick={handleCopy} className="rounded-full">Copy</Button>
              <Button type="button" onClick={handleSend} disabled={sending} className="rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow">{sending ? 'Sending...' : 'Send Email'}</Button>
            </div>
            {sendResult && <p className="text-sm text-gray-600">{sendResult}</p>}
          </Card>
        )}
      </div>
    </div>
  )
}
