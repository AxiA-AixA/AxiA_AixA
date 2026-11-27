import Agreed from "./Agreed";

export const metadata = { title: "Agreed brief · AxiA" };

export default async function Page({ params }) {
  const { id } = await params;
  return <Agreed id={id} />;
}
