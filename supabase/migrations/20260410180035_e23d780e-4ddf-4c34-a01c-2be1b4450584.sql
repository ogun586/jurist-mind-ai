-- Fix existing lawyers with null country_id_ref by matching their state to a country name
UPDATE lawyers SET country_id_ref = c.id
FROM countries c
WHERE lawyers.country_id_ref IS NULL
AND c.name = lawyers.state;

-- Also try matching by country column
UPDATE lawyers SET country_id_ref = c.id
FROM countries c
WHERE lawyers.country_id_ref IS NULL
AND c.name = lawyers.country;