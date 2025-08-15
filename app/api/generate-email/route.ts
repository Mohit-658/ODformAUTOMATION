import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { db } from '@/firebase'
import { doc, getDoc } from 'firebase/firestore'

// Expect POST with JSON { id, to } (from is ignored/optional; server enforces configured sender)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { id, to } = body as { id?: string; to?: string }
        if (!id || !to) return NextResponse.json({ error: 'Missing id/to' }, { status: 400 })

        const ref = doc(db, 'odForms', id)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 })
        }
        const data: any = snap.data()

        const emailHtml = buildEmailHtml(data)

        // Build transporter (supports full SMTP, Gmail or Ethereal test)
        const transporter = await buildSmartTransport()

        const enforcedFrom = process.env.SMTP_USER || process.env.MAIL_FROM
        if (!enforcedFrom) {
            return NextResponse.json({ error: 'Server sender not configured. Set SMTP_USER in .env.local.' }, { status: 500 })
        }

        let info
        try {
            info = await transporter.sendMail({ from: enforcedFrom, to, subject: 'OD Form Submission', html: emailHtml })
        } catch (err: any) {
            // Attempt one Ethereal fallback if initial failed and wasn't already Ethereal
            if (!(err?.__alreadyFallback)) {
                console.warn('Primary mail send failed:', err?.message)
                const fallback = await createEtherealTransport()
                const fbInfo = await fallback.sendMail({ from: enforcedFrom, to, subject: 'OD Form Submission', html: emailHtml })
                return NextResponse.json({ ok: true, messageId: fbInfo.messageId, preview: (nodemailer as any).getTestMessageUrl?.(fbInfo), html: emailHtml, from: enforcedFrom, fallback: true, note: 'Primary SMTP failed; sent with Ethereal test account (not delivered to real inbox). Configure SMTP_* or Gmail App Password.' })
            }
            throw err
        }

        return NextResponse.json({ ok: true, messageId: info.messageId, preview: (nodemailer as any).getTestMessageUrl?.(info), html: emailHtml, from: enforcedFrom, fallback: false })
    } catch (e: any) {
        console.error('Email generation failed', e)
        return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 })
    }
}

async function buildSmartTransport() {
    const host = process.env.SMTP_HOST?.trim()
    const portRaw = process.env.SMTP_PORT
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS
    const secureEnv = process.env.SMTP_SECURE?.toLowerCase()
    const secure = secureEnv === 'true' || secureEnv === '1' || (portRaw === '465')

    // Gmail convenience: if no explicit host but user is gmail
    if (!host && user && /@gmail\.com$/i.test(user) && pass) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        })
    }

    // If all three provided -> standard SMTP
    if (host && user && pass) {
        return nodemailer.createTransport({
            host,
            port: portRaw ? Number(portRaw) : (secure ? 465 : 587),
            secure,
            auth: { user, pass },
            tls: { rejectUnauthorized: false } // helps with some corporate/self-signed certs
        })
    }

    // Partial config detection (avoid confusing localhost attempts)
    if ((host || user || pass) && !(host && user && pass)) {
        console.warn('Partial SMTP configuration detected; falling back to Ethereal test account.')
    }

    return createEtherealTransport()
}

async function createEtherealTransport() {
    const testAccount = await nodemailer.createTestAccount()
    return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: testAccount.user, pass: testAccount.pass }
    })
}

function buildEmailHtml(data: any): string {
    const subjects = Array.isArray(data.subjects) ? data.subjects : []
    const students = Array.isArray(data.students) ? data.students : []
    const mode = data.mode

    const subjectBlocks = subjects.map((s: any) => `<div style='margin-bottom:12px;'>
  <strong>Subject:</strong> ${escapeHtml(s.subjectCode)} ${escapeHtml(s.subjectName)}<br/>
  <strong>Faculty:</strong> ${escapeHtml(s.facultyName)} [${escapeHtml(s.facultyCode)}]<br/>
  <strong>Time:</strong> ${escapeHtml(s.timeSlot)}<br/>
  <strong>Date:</strong> ${escapeHtml(s.date)}
</div>`).join('')

    const studentList = students.map((st: any) => `<li>${escapeHtml(st.name)} (${escapeHtml(st.enrollmentNo)})</li>`).join('')

    return `<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;'>
  <h2>OD Request (${mode === 'multiple' ? 'Bulk' : 'Single'})</h2>
  <h3>Subjects</h3>
  ${subjectBlocks || '<p>No subjects provided.</p>'}
  <h3>Students</h3>
  <ul>${studentList || '<li>No students provided.</li>'}</ul>
  ${data.timetableFileUrl ? `<p>Timetable: <a href='${escapeHtml(data.timetableFileUrl)}'>View</a></p>` : ''}
  <p>Generated automatically.</p>
</body></html>`
}

function escapeHtml(str: string = ''): string {
    return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string))
}
