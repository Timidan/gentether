# Load-Bearing HydraDB Queries

GenTether uses HydraDB through its authenticated HTTP query API. Parameters are sent in the request body rather than interpolated into Cypher.

## Remove the old repository snapshot

```cypher
MATCH (n:GenTetherArtifact)
WHERE n.repository_id = $repositoryId
DETACH DELETE n
```

## Batch-upsert artifacts

```cypher
UNWIND $rows AS row
MERGE (n {id: row.id})
SET n:GenTetherArtifact,
    n.repository_id = row.repository_id,
    n.artifact_key = row.artifact_key,
    n.kind = row.kind,
    n.name = row.name,
    n.path = row.path
```

## Batch-upsert typed relationships

Each relationship type is selected from a closed application enum. Example:

```cypher
UNWIND $rows AS row
MATCH (s:GenTetherArtifact {id: row.from}),
      (d:GenTetherArtifact {id: row.to})
MERGE (s)-[r:GENERATES {id: row.id}]->(d)
SET r.evidence = row.evidence,
    r.confidence = row.confidence
```

The same fixed shape is used for `FEEDS`, `DECLARES`, `IMPORTS`, `VERIFIES` and `CONTAINS`.

## Resolve generated artifact provenance

```cypher
MATCH (s:GenTetherArtifact)-[:FEEDS]->(c:GenTetherArtifact),
      (c)-[:GENERATES]->(g:GenTetherArtifact)
WHERE g.id = $target
RETURN s.id AS source_id,
       c.id AS command_id,
       g.id AS generated_id
LIMIT 100
```

For a source-first query, the same graph pattern uses `WHERE s.id = $target`. Generator commands and generator configuration files use the same typed chain with the target bound to `c.id` or the configuration's `DECLARES` edge.

The HTTP response's `source_id`, `command_id` and `generated_id` values are decoded and used to rebuild the live gate result. A successful request with an empty lineage is not treated as proof.

## Find downstream consumers and tests

```cypher
MATCH (consumer:GenTetherArtifact)-[:IMPORTS*1..4]->(g:GenTetherArtifact)
WHERE g.id = $target
RETURN consumer.id AS consumer_id
LIMIT 200
```

The maximum depth is required and intentionally fixed. Returned `consumer_id` values are mapped back to indexed artifacts and split into consumers and tests. The answer depends on directed reachability, not textual similarity.

## Resolve generator declarations

```cypher
MATCH (cfg:GenTetherArtifact)-[:DECLARES]->(c:GenTetherArtifact)
WHERE c.id = $command
RETURN cfg.id AS declaration_id
LIMIT 100
```

This lets a patch that changes a generator declaration count as an authoritative coordinated change.

## Verify ingestion

```cypher
MATCH (n:GenTetherArtifact)
WHERE n.repository_id = $repositoryId
RETURN count(*) AS total
```

## HTTP request shape

```json
{
  "cell_id": "cell-0",
  "query": "MATCH ...",
  "parameters": {
    "target": 123456789
  }
}
```

Headers:

```text
Authorization: Bearer <token>
X-Graph-Namespace: default
Content-Type: application/json
```
