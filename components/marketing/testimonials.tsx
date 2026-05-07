'use client';

import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const QUOTES = [
  {
    body: 'I ran my last CP2000 in six minutes. Six. The IRC §6201 citation was already there. Felt like cheating.',
    name: 'Pat — solo CPA, Austin TX',
  },
  {
    body: 'We dumped HubSpot and ActiveCampaign in week two. Same workflows in NoticeReply, ~$540/mo back.',
    name: 'Megan — managing partner, 9-person firm, Tampa FL',
  },
  {
    body: 'My partners thought I was crazy when I bought another tool during tax season. Then they saw the time stamps.',
    name: 'Dave — 4-person practice, Sacramento CA',
  },
  {
    body: 'The certified-mail integration alone is worth it. Stamps.com had me printing labels at 11pm last March.',
    name: 'Linh — solo, Westchester NY',
  },
];

export function Testimonials() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">What CPAs are saying</p>
          <h2 className="mt-2 font-serif text-balance text-3xl md:text-4xl lg:text-5xl">
            Words you'd actually tell a peer.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {QUOTES.map((q, i) => (
            <motion.div
              key={q.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <Card className="h-full">
                <CardContent className="p-6">
                  <div className="mb-3 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="size-4 fill-accent text-accent" />
                    ))}
                  </div>
                  <blockquote className="text-base leading-relaxed text-foreground">"{q.body}"</blockquote>
                  <p className="mt-4 text-sm font-medium text-muted-foreground">— {q.name}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
