import { OverrideRequestView } from './override-request-view';

export default async function OverrideRequestPage({
  params,
}: PageProps<'/manager/approvals/[requestId]'>) {
  const { requestId } = await params;

  return <OverrideRequestView requestId={requestId} />;
}
