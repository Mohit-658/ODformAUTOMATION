import { SubjectPayload, StudentPayload } from './firestore'

export function buildPlainTextEmail(subjects: SubjectPayload[], students: StudentPayload[], meta?: { mode?: string; timetableFileUrl?: string | null }) {
    const lines: string[] = []
    lines.push(`OD Request (${meta?.mode === 'multiple' ? 'Bulk' : 'Single'})`)
    lines.push('')
    lines.push('Subjects:')
    subjects.forEach((s, i) => {
        lines.push(`${i + 1}. ${s.subjectCode} ${s.subjectName}`)
        lines.push(`   Faculty: ${s.facultyName} [${s.facultyCode}] | Time: ${s.timeSlot} | Date: ${s.date}`)
    })
    if (!subjects.length) lines.push('  (none)')
    lines.push('')
    lines.push('Students:')
    students.forEach((st, i) => {
        lines.push(`${i + 1}. ${st.name} (${st.enrollmentNo}) - ${st.course} ${st.semester} ${st.section}`)
    })
    if (!students.length) lines.push('  (none)')
    if (meta?.timetableFileUrl) {
        lines.push('')
        lines.push(`Timetable: ${meta.timetableFileUrl}`)
    }
    lines.push('')
    lines.push('Regards,')
    lines.push('ACConduty')
    return lines.join('\n')
}
