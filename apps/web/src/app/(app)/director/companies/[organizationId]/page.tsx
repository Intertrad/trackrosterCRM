import { DirectorCompanyDetailPage } from '@/components/director/director-workspace';
export default async function Page({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  return <DirectorCompanyDetailPage organizationId={organizationId} />;
}
