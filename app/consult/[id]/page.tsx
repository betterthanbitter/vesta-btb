import Link from 'next/link';
import { notFound } from 'next/navigation';
import ConsultForm from '../../../components/ConsultForm.tsx';
import { loadPublishedDirectory } from '../../../src/professionals/directory.ts';
import { getDb } from '../../../src/leads/store.ts';
import { parseSchedulerLink } from '../../../src/directory/schedulerLink.ts';

export const metadata = { robots: { index: false, follow: false } };

export default async function ConsultPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const professional = (await loadPublishedDirectory(await getDb())).find((r) => r.id === id);
  if (!professional) notFound();

  // Only ever return somewhere on this site.
  const back = from && from.startsWith('/') && !from.startsWith('//') ? from : '/';

  return (
    <>
      <header className="top">
        <div className="in"><Link href="/" className="logo">VESTA</Link></div>
      </header>
      <div className="wrap">
        <ConsultForm
          professionalId={professional.id}
          firstName={professional.name.split(' ')[0]}
          sourcePath={back}
          hadScheduler={Boolean(parseSchedulerLink(professional.schedulerUrl))}
        />
      </div>
    </>
  );
}
