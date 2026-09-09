import EnterForm from '../../components/EnterForm.tsx';

export const metadata = {
  title: 'Vesta — preview',
  robots: { index: false, follow: false },
};

export default async function Enter({
  searchParams,
}: { searchParams: Promise<{ next?: string; wrong?: string }> }) {
  const { next, wrong } = await searchParams;
  return <EnterForm next={next ?? '/'} wrong={wrong === '1'} />;
}
