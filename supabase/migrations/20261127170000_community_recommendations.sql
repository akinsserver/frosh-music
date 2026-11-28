-- Frosh Music: Community Recommendations Function
-- Aggregates songs liked and listened to across all users on the platform.

create or replace function public.get_community_trending_songs(p_limit int default 15)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(song), '[]'::jsonb)
  into v_result
  from (
    select
      elem as song,
      count(*) as frequency
    from public.user_libraries ul,
    lateral jsonb_array_elements(
      case 
        when jsonb_typeof(ul.liked_songs) = 'array' and jsonb_typeof(ul.history) = 'array' 
        then ul.liked_songs || ul.history
        when jsonb_typeof(ul.liked_songs) = 'array' then ul.liked_songs
        when jsonb_typeof(ul.history) = 'array' then ul.history
        else '[]'::jsonb
      end
    ) elem
    where elem->>'id' is not null and elem->>'title' is not null
    group by elem->>'id', elem
    order by count(*) desc, max(ul.updated_at) desc
    limit p_limit
  ) t;

  return v_result;
end;
$$;

grant execute on function public.get_community_trending_songs(int) to anon, authenticated;
