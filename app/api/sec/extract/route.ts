import { NextRequest, NextResponse } from 'next/server';
import { secClient } from '../../../../lib/sec-client';
import { EmailGenerator, scoreByTitle } from '../../../../lib/email-generator';
import { upsertLead, ensureLeadsTable } from '../../../../lib/leads';
import { hasDatabase } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cik = body.cik;
    const filingTypes: string[] = body.filingTypes || [
      body.filingType || '10-K',
      'DEF 14A',
      '10-Q',
    ];
    const generateCount = Math.min(Number(body.generateCount) || 20, 50);
    const save = body.save !== false;

    if (!cik) {
      return NextResponse.json({ error: 'CIK is required' }, { status: 400 });
    }

    if (!process.env.SEC_USER_AGENT) {
      return NextResponse.json(
        {
          error:
            'Set SEC_USER_AGENT env (e.g. "CryptoByt (you@domain.com)") — SEC blocks requests without it.',
        },
        { status: 400 }
      );
    }

    const cleanCik = String(cik).replace(/\D/g, '');
    const companyInfo = await secClient.getCompany(cleanCik);
    const companyName =
      companyInfo?.name?.trim() || `Company CIK ${cleanCik}`;
    const domain = EmailGenerator.guessDomain(
      companyName,
      companyInfo?.ticker
    );

    let executives: Awaited<
      ReturnType<typeof secClient.extractExecutives>
    > = [];
    let usedFiling = filingTypes[0];

    for (const ft of filingTypes) {
      executives = await secClient.extractExecutives(cleanCik, ft);
      if (executives.length > 0) {
        usedFiling = ft;
        break;
      }
    }

    if (executives.length === 0) {
      return NextResponse.json(
        {
          error: `No executives found for CIK ${cleanCik}. Tried: ${filingTypes.join(', ')}`,
        },
        { status: 404 }
      );
    }

    if (save && hasDatabase()) {
      await ensureLeadsTable();
    }

    const slice = executives.slice(0, generateCount);
    let candidatesGenerated = 0;
    const savedLeads = [];

    for (const exec of slice) {
      const candidates = EmailGenerator.generate(exec.name, {
        domain,
        includeGmail: true,
      }).slice(0, 3);

      candidatesGenerated += candidates.length;

      for (const cand of candidates) {
        if (save && hasDatabase()) {
          const lead = await upsertLead({
            name: exec.name,
            title: exec.title,
            company: companyName,
            email: cand.email,
            source: `SEC ${usedFiling} + ${cand.type}`,
            score: scoreByTitle(exec.title),
            tags: JSON.stringify([
              'Executive',
              cand.type,
              cand.pattern,
              usedFiling,
            ]),
            status: 'NEW',
            cik: cleanCik,
            filing_type: usedFiling,
          });
          if (lead) savedLeads.push(lead);
        } else {
          savedLeads.push({
            name: exec.name,
            title: exec.title,
            company: companyName,
            email: cand.email,
            source: `SEC ${usedFiling} + ${cand.type}`,
            score: scoreByTitle(exec.title),
          });
        }
      }
    }

    const uniqueByEmail = Array.from(
      new Map(
        savedLeads
          .filter((l: any) => l.email)
          .map((l: any) => [l.email, l])
      ).values()
    );

    return NextResponse.json({
      success: true,
      company: companyName,
      filingUsed: usedFiling,
      domainGuess: domain || null,
      totalExtracted: executives.length,
      candidatesGenerated,
      saved: uniqueByEmail.length,
      leads: uniqueByEmail,
      note:
        'Pattern-based candidates from public SEC names. Use /api/verify for MX checks. Add ZEROBOUNCE_API_KEY for inbox-level verification.',
    });
  } catch (error: any) {
    console.error('SEC extract error:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Failed to extract. Check SEC_USER_AGENT + DATABASE_URL.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('q');
  if (!q) {
    return NextResponse.json({
      service: 'SEC extract',
      usage: 'POST { cik, filingType?, generateCount?, save? } or GET ?q=company',
    });
  }
  const companies = await secClient.searchCompanies(q);
  return NextResponse.json({ success: true, companies });
}
