"use client"

import type React from "react"

import { useState } from "react"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { saveODForm } from "@/lib/firestore"
import { storage } from "@/firebase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, Plus, Minus, ArrowLeft } from "lucide-react"
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

interface ODFormProps {
  onBack: () => void
}

export function ODForm({ onBack }: ODFormProps) {
  const [numberOfSubjects, setNumberOfSubjects] = useState<number>(1)
  const [subjects, setSubjects] = useState<Subject[]>([
    {
      id: "1",
      subjectName: "",
      subjectCode: "",
      timeSlot: "",
      facultyName: "",
      facultyCode: "",
      date: "",
    },
  ])
  const [students, setStudents] = useState<Student[]>([
    {
      id: "1",
      name: "",
      semester: "",
      course: "",
      section: "",
      enrollmentNo: "",
    },
  ])
  const [timetableFile, setTimetableFile] = useState<File | null>(null)

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
    setSubjects((prev) => prev.map((subject) => (subject.id === id ? { ...subject, [field]: value } : subject)))
  }

  const addStudent = () => {
    const newStudent: Student = {
      id: (students.length + 1).toString(),
      name: "",
      semester: "",
      course: "",
      section: "",
      enrollmentNo: "",
    }
    setStudents((prev) => [...prev, newStudent])
  }

  const removeStudent = (id: string) => {
    if (students.length > 1) {
      setStudents((prev) => prev.filter((student) => student.id !== id))
    }
  }

  const updateStudent = (id: string, field: keyof Student, value: string) => {
    setStudents((prev) => prev.map((student) => (student.id === id ? { ...student, [field]: value } : student)))
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setTimetableFile(file)
    }
  }

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [toEmail, setToEmail] = useState("")
  const [generatedMail, setGeneratedMail] = useState("")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  // Computed form completeness (all subject & student fields + timetable file present)
  const isSubjectsComplete = subjects.every(s =>
    s.subjectName.trim() &&
    s.subjectCode.trim() &&
    s.timeSlot.trim() &&
    s.facultyName.trim() &&
    s.facultyCode.trim() &&
    s.date.trim()
  )
  const isStudentsComplete = students.every(st =>
    st.name.trim() &&
    st.semester.trim() &&
    st.course.trim() &&
    st.section.trim() &&
    st.enrollmentNo.trim()
  )
  const isFormComplete = isSubjectsComplete && isStudentsComplete && !!timetableFile

  const handleSubmit = async () => {
    setSaving(true)
    setSaveError(null)
    setSavedId(null)
    try {
      let timetableFileUrl: string | null = null
      if (timetableFile) {
        const fileRef = ref(storage, `timetables/${Date.now()}-${timetableFile.name}`)
        await uploadBytes(fileRef, timetableFile)
        timetableFileUrl = await getDownloadURL(fileRef)
      }
      const id = await saveODForm({
        subjects: subjects.map(({ id, ...rest }) => rest),
        students: students.map(({ id, ...rest }) => rest),
        timetableFileUrl,
        mode: "single",
      })
      setSavedId(id)
      const emailText = buildPlainTextEmail(
        subjects.map(({ id, ...r }) => r),
        students.map(({ id, ...r }) => r),
        { mode: 'single', timetableFileUrl }
      )
      setGeneratedMail(emailText)
    } catch (e: any) {
      console.error("Failed to save OD form", e)
      if (e?.code === 'permission-denied') {
        setSaveError('Permission denied: check Firestore security rules.')
      } else {
        setSaveError(e.message || "Failed to save form")
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
    if (!toEmail) { setSendResult('Provide recipient email'); return }
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: savedId, to: toEmail })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setSendResult('Email sent (ID: ' + json.messageId + ')')
    } catch (e: any) {
      setSendResult(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-gray-200">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <img src="/images/acc-logo.png" alt="Amity Coding Club Logo" className="w-16 h-16 object-contain" />
        <h1 className="text-2xl font-grandiflora text-black">OD Form - Single Entry</h1>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Subject Details Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6 text-black">Subject Details</h2>

          {/* Number of Subjects Selector */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-3 block">Number of Subjects (Max 8)</Label>
            <Select
              value={numberOfSubjects.toString()}
              onValueChange={(value) => handleSubjectCountChange(Number.parseInt(value))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 8 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Forms */}
          <div className="space-y-6">
            {subjects.map((subject, index) => (
              <Card key={subject.id} className="p-4 bg-gray-50">
                <h3 className="font-medium mb-4">Subject {index + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`subject-name-${subject.id}`} className="block mb-2">
                      Subject Name
                    </Label>
                    <Input
                      id={`subject-name-${subject.id}`}
                      value={subject.subjectName}
                      onChange={(e) => updateSubject(subject.id, "subjectName", e.target.value)}
                      placeholder="Enter subject name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`subject-code-${subject.id}`} className="block mb-2">
                      Subject Code
                    </Label>
                    <Input
                      id={`subject-code-${subject.id}`}
                      value={subject.subjectCode}
                      onChange={(e) => updateSubject(subject.id, "subjectCode", e.target.value)}
                      placeholder="Enter subject code"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`time-slot-${subject.id}`} className="block mb-2">
                      Time Slot
                    </Label>
                    <Select
                      value={subject.timeSlot}
                      onValueChange={(value) => updateSubject(subject.id, "timeSlot", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="09:15 AM - 10:10 AM">09:15 AM - 10:10 AM</SelectItem>
                        <SelectItem value="10:15 AM - 11:10 AM">10:15 AM - 11:10 AM</SelectItem>
                        <SelectItem value="11:15 AM - 12:10 PM">11:15 AM - 12:10 PM</SelectItem>
                        <SelectItem value="12:15 PM - 01:10 PM">12:15 PM - 01:10 PM</SelectItem>
                        <SelectItem value="01:15 PM - 02:10 PM">01:15 PM - 02:10 PM</SelectItem>
                        <SelectItem value="02:15 PM - 03:10 PM">02:15 PM - 03:10 PM</SelectItem>
                        <SelectItem value="03:15 PM - 04:10 PM">03:15 PM - 04:10 PM</SelectItem>
                        <SelectItem value="04:15 PM - 05:10 PM">04:15 PM - 05:10 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`faculty-name-${subject.id}`} className="block mb-2">
                      Faculty Name
                    </Label>
                    <Input
                      id={`faculty-name-${subject.id}`}
                      value={subject.facultyName}
                      onChange={(e) => updateSubject(subject.id, "facultyName", e.target.value)}
                      placeholder="Enter faculty name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`faculty-code-${subject.id}`} className="block mb-2">
                      Faculty Code
                    </Label>
                    <Input
                      id={`faculty-code-${subject.id}`}
                      value={subject.facultyCode}
                      onChange={(e) => updateSubject(subject.id, "facultyCode", e.target.value)}
                      placeholder="Enter faculty code"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`date-${subject.id}`} className="block mb-2">
                      Date
                    </Label>
                    <Input
                      id={`date-${subject.id}`}
                      type="date"
                      value={subject.date}
                      onChange={(e) => updateSubject(subject.id, "date", e.target.value)}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Timetable Upload */}
          <div className="mt-6">
            <Label className="text-sm font-medium mb-3 block">Upload Timetable Image</Label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="timetable-upload"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById("timetable-upload")?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {timetableFile ? "Change File" : "Upload Timetable"}
              </Button>
              {timetableFile && <span className="text-sm text-gray-600">{timetableFile.name}</span>}
            </div>
          </div>
        </Card>

        {/* Student Details Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-black">Student Details</h2>
            <Button onClick={addStudent} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4" />
              Add Student
            </Button>
          </div>

          <div className="space-y-6">
            {students.map((student, index) => (
              <Card key={student.id} className="p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Student {index + 1}</h3>
                  {students.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStudent(student.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor={`name-${student.id}`} className="block mb-2">
                      Name
                    </Label>
                    <Input
                      id={`name-${student.id}`}
                      value={student.name}
                      onChange={(e) => updateStudent(student.id, "name", e.target.value)}
                      placeholder="Enter student name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`semester-${student.id}`} className="block mb-2">
                      Semester
                    </Label>
                    <Input
                      id={`semester-${student.id}`}
                      value={student.semester}
                      onChange={(e) => updateStudent(student.id, "semester", e.target.value)}
                      placeholder="Enter semester"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`course-${student.id}`} className="block mb-2">
                      Course
                    </Label>
                    <Input
                      id={`course-${student.id}`}
                      value={student.course}
                      onChange={(e) => updateStudent(student.id, "course", e.target.value)}
                      placeholder="Enter course"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`section-${student.id}`} className="block mb-2">
                      Section
                    </Label>
                    <Input
                      id={`section-${student.id}`}
                      value={student.section}
                      onChange={(e) => updateStudent(student.id, "section", e.target.value)}
                      placeholder="Enter section"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor={`enrollment-${student.id}`} className="block mb-2">
                      Enrollment No
                    </Label>
                    <Input
                      id={`enrollment-${student.id}`}
                      value={student.enrollmentNo}
                      onChange={(e) => updateStudent(student.id, "enrollmentNo", e.target.value)}
                      placeholder="Enter enrollment number"
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* Submit Button */}
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={saving || !isFormComplete}
            className="px-8 py-3 bg-black text-white hover:bg-black/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-jura"
          >
            {saving ? "Saving..." : "Generate Mail"}
          </Button>
          {!isFormComplete && (
            <p className="text-xs text-gray-500">Fill all subject, student fields and upload timetable to enable.</p>
          )}
          {savedId && <p className="text-sm text-green-600">Saved (ID: {savedId})</p>}
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </div>

        {/* Generated Email Preview Section */}
        {generatedMail && (
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold text-black">Generated Mail</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="block mb-2">To (Recipient Email)</Label>
                <Input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="recipient@example.com" />
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
                {sending ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
            {sendResult && <p className="text-sm text-gray-600">{sendResult}</p>}
          </Card>
        )}
      </div>
    </div>
  )
}
