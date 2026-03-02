---
name: directus-schema
description: Query the Directus instance via MCP to inspect collections, fields, and relationships. Use when mapping Directus data to SAP entities.
allowed-tools: Read, Grep, Glob
---

# Directus Schema Explorer

Use the Directus MCP server to inspect the live schema and help map fields between Directus collections and SAP entities.

## Common Mappings

### Business Partners
| Directus (`business_partners`) | SAP (`BusinessPartners`) |
|-------------------------------|--------------------------|
| `company_name` | `CardName` |
| `relationship_type` = customer | `CardType` = `C` |
| `relationship_type` = supplier | `CardType` = `S` |
| `status` | `Frozen` (`Y`/`N`) |
| `website` | `Website` |
| `phone` | `Phone1` |
| `email` | `EmailAddress` |

### Items
| SAP (`Items`) | Directus (`items`) |
|---------------|-------------------|
| `ItemCode` | `sku` or `mpn` |
| `ItemName` | `description` |
| `Manufacturer` | lookup `manufacturers` by name |
| `QuantityOnStock` | `quantity_on_hand` |
| `AvgStdPrice` | `cost_price` |

## Tasks
- Inspect Directus collections to confirm field names and types
- Identify missing fields that need creating
- Validate relationship mappings between collections
