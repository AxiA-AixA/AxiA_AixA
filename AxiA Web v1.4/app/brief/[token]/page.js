import Brief from "./Brief";

export const metadata = { title: "Visual brief · AxiA" };

export default async function Page({ params }) {
  const { token } = await params;
  return <Brief token={token} />;
}
