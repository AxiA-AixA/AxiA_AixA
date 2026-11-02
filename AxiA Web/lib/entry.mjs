// One prototype library item, shaped for the graph. Shared by the live app and the demo export.
export function toEntry(i, image) {
  return {
    id: i.id, url: i.page_url || null, title: i.title, image,
    fields: i.fields?.length ? i.fields : i.field ? [i.field] : [], group_name: i.group_name, status: i.status,
    tags: [...(i.user_tags ?? []), ...(i.tags ?? [])],
  };
}
