import Project from "./Project";

export const metadata = { title: "Project · AxiA" };

export default async function Page({ params }) {
  const { id } = await params;
  return <Project id={id} />;
}
