import { OgFrame } from '@/components/spiral-galaxy/OgFrame';

// Not meant to be browsed; it is the source frame for the Open Graph capture.
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  return <OgFrame />;
}
