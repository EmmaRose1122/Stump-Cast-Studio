import { useState } from 'react';
import { StatusChip } from '../shell/AppShell';
import {
  Banner,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  Select,
  Slider,
  Switch,
  TabPanel,
  Tabs,
  Tooltip,
} from '../ui';
import { useAdmin } from '../store';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section aria-labelledby={`g-${title}`} className="mb-8">
    <h2 id={`g-${title}`} className="mb-3 font-heading text-lg font-semibold">
      {title}
    </h2>
    <div className="flex flex-wrap items-start gap-4">{children}</div>
  </section>
);

/** Design QA: every component in every state. Open at #/gallery. */
export const Gallery = () => {
  const [on, setOn] = useState(true);
  const [vol, setVol] = useState(60);
  const [sel, setSel] = useState('b');
  const [open, setOpen] = useState(false);
  const toast = useAdmin((s) => s.toast);

  return (
    <div data-testid="gallery">
      <h1 className="mb-6 font-heading text-2xl font-bold">Component gallery</h1>

      <Section title="Button">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button variant="primary" size="lg">
          Show on stream
        </Button>
      </Section>

      <Section title="IconButton">
        <IconButton label="Refresh">⟳</IconButton>
        <IconButton label="Close">✕</IconButton>
      </Section>

      <Section title="Card">
        <Card title="Card title" className="w-72">
          Card content
        </Card>
      </Section>

      <Section title="Tabs">
        <div className="w-full max-w-md">
          <Tabs
            tabs={[
              { value: 'a', label: 'Overview' },
              { value: 'b', label: 'Details' },
            ]}
          >
            <TabPanel value="a">Overview panel</TabPanel>
            <TabPanel value="b">Details panel</TabPanel>
          </Tabs>
        </div>
      </Section>

      <Section title="Switch">
        <Switch id="g-switch" checked={on} onCheckedChange={setOn} label="Auto sounds" />
      </Section>

      <Section title="Slider">
        <div className="w-72">
          <Slider
            label="Volume"
            value={vol}
            min={0}
            max={100}
            onValueChange={setVol}
            format={(v) => `${v}%`}
          />
        </div>
      </Section>

      <Section title="Select">
        <Select
          label="Layout"
          value={sel}
          onValueChange={setSel}
          options={[
            { value: 'a', label: 'Classic' },
            { value: 'b', label: 'Arena' },
            { value: 'c', label: 'Ticker' },
          ]}
        />
      </Section>

      <Section title="Dialog">
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Delete track?"
          description="This cannot be undone."
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                Delete
              </Button>
            </>
          }
        />
      </Section>

      <Section title="Toast">
        <Button
          onClick={() =>
            toast({ title: 'Saved', description: 'Settings updated', kind: 'success' })
          }
        >
          Success toast
        </Button>
        <Button onClick={() => toast({ title: 'Something went wrong', kind: 'error' })}>
          Error toast
        </Button>
      </Section>

      <Section title="Tooltip">
        <Tooltip content="Helpful hint">
          <Button>Hover or focus me</Button>
        </Tooltip>
      </Section>

      <Section title="EmptyState">
        <div className="w-full max-w-md">
          <EmptyState
            title="No tracks yet"
            description="Add your first sound to get started."
            action={<Button variant="primary">Add track</Button>}
          />
        </div>
      </Section>

      <Section title="Banner">
        <div className="grid w-full max-w-xl gap-3">
          <Banner tone="info" title="Info">
            Everything is working.
          </Banner>
          <Banner tone="success" title="Success">
            Saved.
          </Banner>
          <Banner tone="warn" title="Warning" actions={<Button>Mute alarm</Button>}>
            Score data is 40 seconds old.
          </Banner>
          <Banner tone="error" title="Error">
            The data source is disconnected.
          </Banner>
        </div>
      </Section>

      <Section title="Status chips">
        <StatusChip
          chip={{ id: 'provider', label: 'Provider', value: 'Extension connected', state: 'ok' }}
        />
        <StatusChip
          chip={{ id: 'provider', label: 'Provider', value: 'Data stale', state: 'warn' }}
        />
        <StatusChip
          chip={{ id: 'provider', label: 'Provider', value: 'Disconnected', state: 'error' }}
        />
        <StatusChip chip={{ id: 'licence', label: 'Licence', value: 'Free', state: 'neutral' }} />
      </Section>
    </div>
  );
};
