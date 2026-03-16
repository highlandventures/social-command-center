// Branded email template for report distribution
// Uses @react-email/components for cross-client HTML email rendering

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Row,
  Column,
  Heading,
  Preview,
  Hr,
} from '@react-email/components';

const BRAND_PURPLE = '#5B56F5';
const FONT_STACK = 'Helvetica, Arial, sans-serif';

function formatKPIValue(kpi) {
  const v = kpi.value;
  if (v == null) return '\u2014';
  switch (kpi.format) {
    case 'number':
      return typeof v === 'number' ? v.toLocaleString() : String(v);
    case 'percent':
      return `${v}%`;
    case 'delta':
      return `${v > 0 ? '+' : ''}${v}`;
    case 'text':
      return String(v);
    default:
      return typeof v === 'number' ? v.toLocaleString() : String(v);
  }
}

function formatDelta(delta) {
  if (delta == null) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}%`;
}

export function ReportEmail({ report, appUrl }) {
  const content = report?.content || {};
  const kpis = (content.kpis || []).filter((k) => k.format !== 'text');
  const coverage = content.coveragePeriod || report?.coveragePeriod || {};

  // Preview text: first 3 KPI labels + values
  const previewParts = kpis.slice(0, 3).map((k) => `${k.label}: ${formatKPIValue(k)}`);
  const previewText = previewParts.join(' | ') || report?.title || 'Report';

  const dateRange = coverage.start
    ? `${new Date(coverage.start).toLocaleDateString()} - ${new Date(coverage.end).toLocaleDateString()}`
    : '';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: '#f6f6f6', fontFamily: FONT_STACK, margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 0' }}>

          {/* Purple header */}
          <Section style={{
            backgroundColor: BRAND_PURPLE,
            borderRadius: '8px 8px 0 0',
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <Heading style={{ color: '#ffffff', fontSize: '22px', fontWeight: 700, margin: 0 }}>
              {report?.title || 'Report'}
            </Heading>
            {dateRange && (
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', margin: '8px 0 0' }}>
                {dateRange}
              </Text>
            )}
          </Section>

          {/* KPI Summary Table */}
          {kpis.length > 0 && (
            <Section style={{ backgroundColor: '#ffffff', padding: '24px' }}>
              <Heading as="h2" style={{ fontSize: '16px', color: '#111827', margin: '0 0 16px' }}>
                Key Metrics
              </Heading>
              {kpis.map((kpi, i) => (
                <Row key={i} style={{
                  borderBottom: i < kpis.length - 1 ? '1px solid #e5e7eb' : 'none',
                  padding: '10px 0',
                }}>
                  <Column style={{ width: '60%' }}>
                    <Text style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
                      {kpi.label}
                    </Text>
                  </Column>
                  <Column style={{ width: '40%', textAlign: 'right' }}>
                    <Text style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
                      {formatKPIValue(kpi)}
                      {kpi.delta != null && (
                        <span style={{
                          fontSize: '11px',
                          marginLeft: '6px',
                          color: kpi.delta >= 0 ? '#22c55e' : '#ef4444',
                        }}>
                          {formatDelta(kpi.delta)}
                        </span>
                      )}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          {/* Executive Summary */}
          {content.executiveSummary && (
            <Section style={{ backgroundColor: '#ffffff', padding: '0 24px 24px' }}>
              <Heading as="h2" style={{ fontSize: '16px', color: '#111827', margin: '0 0 12px' }}>
                Executive Summary
              </Heading>
              <Text style={{ fontSize: '13px', lineHeight: '1.6', color: '#374151', margin: 0 }}>
                {content.executiveSummary}
              </Text>
            </Section>
          )}

          {/* CTA Button */}
          <Section style={{ backgroundColor: '#ffffff', padding: '0 24px 32px', textAlign: 'center', borderRadius: '0 0 8px 8px' }}>
            <Button
              href={`${appUrl || 'https://app.socialcommand.com'}/reports/${report?.id || ''}`}
              style={{
                backgroundColor: BRAND_PURPLE,
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                padding: '12px 32px',
                borderRadius: '6px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              View Full Report
            </Button>
          </Section>

          {/* Footer */}
          <Section style={{ padding: '16px 24px', textAlign: 'center' }}>
            <Hr style={{ borderColor: '#e5e7eb', margin: '0 0 12px' }} />
            <Text style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
              Generated by Social Command
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}
