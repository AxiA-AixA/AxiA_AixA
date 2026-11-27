import Graph from "../Graph";

export const metadata = { title: "Map · AxiA" };

// The reference map, seen through the AxiA symbol or, with ?lens=<project id>, through a project.
export default async function Map({ searchParams }) {
  const { lens } = await searchParams;
  return <Graph lens={typeof lens === "string" ? lens : undefined} />;
}
