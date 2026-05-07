'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Clock, DollarSign, TrendingUp } from 'lucide-react';

/**
 * ROI calculator. Per Sabrina §21 "Pitch formula — only two levers: save
 * time, make money. Never pitch features." This component literally puts
 * the time + money math in front of the visitor's eyes with sliders they
 * can move. Hormozi value-anchoring + Sabrina pitch formula in one.
 *
 * All math is client-side — no API call.
 */

const FOUNDING_PRICE = 99;

export function RoiCalculator() {
  const [noticesPerYear, setNoticesPerYear] = useState(40);
  const [minutesOldWay, setMinutesOldWay] = useState(75);
  const [hourlyRate, setHourlyRate] = useState(150);

  const minutesNewWay = 8;

  const result = useMemo(() => {
    const hoursOld = (noticesPerYear * minutesOldWay) / 60;
    const hoursNew = (noticesPerYear * minutesNewWay) / 60;
    const hoursSaved = hoursOld - hoursNew;
    const dollarsSaved = hoursSaved * hourlyRate;
    const dollarsCost = FOUNDING_PRICE * 12;
    const dollarsNet = dollarsSaved - dollarsCost;
    const breakevenNotices = Math.ceil(dollarsCost / Math.max(0.01, ((minutesOldWay - minutesNewWay) / 60) * hourlyRate));
    return { hoursSaved, dollarsSaved, dollarsCost, dollarsNet, breakevenNotices, hoursOld, hoursNew };
  }, [noticesPerYear, minutesOldWay, hourlyRate]);

  return (
    <section className="bg-primary/5 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">The math, on your numbers</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            How much is notice grunt-work costing you right now?
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Drag the sliders to your firm's reality. The math runs locally — no signup, no email gate.
          </p>
        </div>

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-[1fr,1fr]">
          {/* Inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="size-5 text-accent" /> Your inputs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-7 pt-2">
              <Slider
                label="IRS notices your firm processes per year"
                value={noticesPerYear}
                onChange={setNoticesPerYear}
                min={5}
                max={400}
                step={5}
                suffix=" / year"
                anchor="Average solo CPA: 40-80. 5-person firm: 200-400."
              />
              <Slider
                label="Average minutes per notice today (manual)"
                value={minutesOldWay}
                onChange={setMinutesOldWay}
                min={20}
                max={180}
                step={5}
                suffix=" min each"
                anchor="Most CPAs report 60-120 min for a CP2000 with research + drafting + certified-mail prep."
              />
              <Slider
                label="Your effective hourly rate"
                value={hourlyRate}
                onChange={setHourlyRate}
                min={75}
                max={400}
                step={25}
                prefix="$"
                suffix=" / hr"
                anchor="What you'd bill a client for an hour of senior tax-resolution work."
              />
            </CardContent>
          </Card>

          {/* Outputs */}
          <Card className="border-2 border-accent/40 bg-card shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="size-5 text-accent" /> What that means
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <BigStat
                icon={<Clock className="size-5" />}
                label="Hours saved per year"
                value={result.hoursSaved.toFixed(0)}
                suffix=" hrs"
                muted={`${result.hoursOld.toFixed(0)} → ${result.hoursNew.toFixed(0)} hrs/yr`}
              />
              <BigStat
                icon={<DollarSign className="size-5" />}
                label="Time recovered, in dollars"
                value={result.dollarsSaved.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                prefix="$"
                muted={`@ $${hourlyRate}/hr`}
              />
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                <SmallStat label="NoticeReply Founding cost" value={`$${result.dollarsCost.toLocaleString()}/yr`} />
                <SmallStat label="Net annual gain" value={`$${result.dollarsNet.toLocaleString()}`} positive={result.dollarsNet > 0} />
              </div>
              <div className="rounded-md border border-accent/40 bg-accent/10 p-4 text-sm">
                <p className="font-semibold">
                  Breakeven: <span className="font-mono">{result.breakevenNotices}</span> notices
                </p>
                <p className="mt-1 text-muted-foreground">
                  After the {result.breakevenNotices}-th notice you process this year, every minute saved is pure profit. You're processing them already — you'll just stop spending {minutesOldWay - minutesNewWay} minutes each.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Math = hours_saved × hourly_rate − $99/mo subscription. Doesn't include the time saved from CRM, workflows, and analytics — those replace HubSpot/ActiveCampaign for most firms (~$400-600/mo on top).
        </p>
      </div>
    </section>
  );
}

type SliderProps = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
  anchor?: string;
};

function Slider({ label, value, onChange, min, max, step, prefix = '', suffix = '', anchor }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="font-mono text-base font-semibold text-foreground">
          {prefix}
          {value.toLocaleString()}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary"
        style={{
          background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--secondary) ${pct}%, var(--secondary) 100%)`,
        }}
        aria-label={label}
      />
      {anchor && <p className="mt-1 text-[11px] text-muted-foreground">{anchor}</p>}
    </div>
  );
}

function BigStat({
  icon,
  label,
  value,
  prefix = '',
  suffix = '',
  muted,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  prefix?: string;
  suffix?: string;
  muted?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 font-serif text-4xl">
        {prefix}
        {value}
        <span className="text-xl text-muted-foreground">{suffix}</span>
      </p>
      {muted && <p className="text-xs text-muted-foreground">{muted}</p>}
    </div>
  );
}

function SmallStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-md bg-secondary/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold ${positive ? 'text-emerald-700' : ''}`}>{value}</p>
    </div>
  );
}
