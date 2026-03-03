---
name: directus-expert
description: >
  Full Directus expert skill — schema, MCP tools, flows, collections, fields, relations.
  Load when doing anything with this Directus instance: creating/modifying collections,
  building flows, querying data, or mapping SAP entities to Directus collections.
allowed-tools: Read, Grep, Glob, mcp__directus__schema, mcp__directus__items, mcp__directus__collections, mcp__directus__fields, mcp__directus__relations, mcp__directus__flows, mcp__directus__operations, mcp__directus__trigger-flow, mcp__directus__files, mcp__directus__folders, mcp__directus__assets
---

# Directus Expert — SupplyHubDev

## Instance
- **URL**: http://10.1.3.81:3027
- **Version**: 11.12+ (native MCP enabled, `MCP_ENABLED=true`)
- **Project name**: SupplyHubDev (Test Environment)
- **MCP config**: `.mcp.json` using `DIRECTUS_URL` and `DIRECTUS_TOKEN` from `.env`

---

## MCP Tools Available

| Tool | Purpose |
|------|---------|
| `mcp__directus__schema` | Discover collections & field definitions (read-only) |
| `mcp__directus__items` | CRUD on any collection |
| `mcp__directus__collections` | Create/update/delete collections |
| `mcp__directus__fields` | Create/update/delete fields on collections |
| `mcp__directus__relations` | Define M2O, O2M, M2M, M2A relationships |
| `mcp__directus__flows` | Create/manage automation flows |
| `mcp__directus__operations` | Add operations to flows |
| `mcp__directus__trigger-flow` | Trigger a flow programmatically |
| `mcp__directus__files` | Manage file metadata |
| `mcp__directus__folders` | Manage file folders |
| `mcp__directus__assets` | Get base64 file content |

### Workflow: Always schema-first
1. `mcp__directus__schema` (no keys) → get collection list
2. `mcp__directus__schema` with `keys: ["collection"]` → get field details
3. Then CRUD or build flows

---

## Live Schema — Custom Collections

### Collection Folders (UI only, not DB tables)
- `registry` — product registry (items, products, collections, attributes)
- `sap` — SAP-synced entities
- `shopify` — Shopify-synced entities

### All Custom Collections
```
addresses                      attribute_sets
attribute_sets_attributes      business_partner_groups
business_partners              business_partners_addresses
business_partners_addresses_locations  business_partners_contacts
business_partners_equipment    business_partners_phone_numbers
collections                    collections_attributes
collections_products           competitors
contacts                       contacts_phone_numbers
countries                      equipment
equipment_documents            equipment_groups
equipment_images               equipment_repair_parts
item_groups                    items
locations                      manufacturers
manufacturers_competitors      material_price_groups
material_price_groups_collections  material_price_groups_items
pages                          pages_collections
phone_numbers                  price_lists
price_lists_files              price_lists_items
price_lists_items_breaks       products
products_alternates            products_attributes
products_cross_sells           products_documents
products_images                products_items
products_repair_parts          prompt_groups
prompt_message_roles           prompt_messages
prompts                        prompt_sets
prompt_sets_prompts            prompts_providers
provider_groups                providers
regions                        scrapes
scrapes_sources
```

---

## Key Collection Schemas

### `business_partners`
Primary key: `id` (integer, auto-increment)

| Field | Type | Notes |
|-------|------|-------|
| `status` | string | `active` \| `inactive` |
| `name` | string | required |
| `relationship_type` | string | `customer` \| `supplier` |
| `sap_id` | string | readonly — `OCRD.CardCode` |
| `shopify_id` | integer | readonly |
| `is_national_account` | boolean | required |
| `website` | string | |
| `remarks` | text | rich HTML |
| `business_partner_groups_id` | M2O → `business_partner_groups` | required |
| `logo_id` | M2O → `directus_files` | |
| `default_shipping_business_partners_addresses_id` | M2O → `business_partners_addresses` | |
| `default_billing_business_partners_addresses_id` | M2O → `business_partners_addresses` | |
| `contacts` | M2M → `contacts` via `business_partners_contacts` | |
| `addresses` | M2M → `addresses` via `business_partners_addresses` | |
| `phone_numbers` | M2M → `phone_numbers` via `business_partners_phone_numbers` | |
| `equipment` | M2M → `equipment` via `business_partners_equipment` | |
| `price_lists` | O2M → `price_lists` | |

**SAP mapping**: `sap_id` = `CardCode`, `name` = `CardName`, `relationship_type` customer/supplier = `CardType` C/S

---

### `items` (SAP Items / Shopify Variants)
Primary key: `id` (integer)

| Field | Type | Notes |
|-------|------|-------|
| `status` | string | `active` \| `draft` \| `inactive` |
| `sku` | string | readonly — SAP `ItemCode` |
| `mpn` | string | Manufacturer Part Number |
| `description` | string | required — SAP `ItemName` |
| `mfr_list_price` | decimal | SAP `"List"`, Shopify `Compare At Price` |
| `base_cost` | decimal | readonly — SAP `"Cost"`, Shopify `Variant Cost` |
| `offer_price` | decimal | readonly — SAP `"Price"`, Shopify `Variant Price` |
| `min_sale_qty` | integer | required |
| `production_type` | string | `MTS` \| `ATO` \| `MTO` |
| `shipping_category` | string | `parcel` \| `LTL` |
| `unit_weight_lb` | decimal | |
| `shipping_weight_lb` | decimal | unit + ~2 lbs packaging |
| `shipping_length_in` | decimal | |
| `shipping_width_in` | decimal | |
| `shipping_height_in` | decimal | |
| `shipping_volume_in` | decimal | readonly, computed L×W×H |
| `barcode` | string | UPC (12) or EAN (13) |
| `hs_code` | string | up to 10 digits |
| `manufacturers_id` | M2O → `manufacturers` | required |
| `item_groups_id` | M2O → `item_groups` | required |
| `countries_id` | M2O → `countries` | country of origin |
| `products` | M2M → `products` via `products_items` | Shopify Product Variants |
| `material_price_groups` | M2M → `material_price_groups` | |
| `price_lists` | M2M → `price_lists` via `price_lists_items` | |
| `scrapes` | O2M → `scrapes` | |

---

### `products` (Shopify Products)
Primary key: `id` (integer)

| Field | Type | Notes |
|-------|------|-------|
| `status` | string | `active` \| `draft` \| `discontinued` |
| `title` | string | required |
| `description` | text | required, rich HTML |
| `slug` | string | readonly |
| `shopify_id` | integer | readonly |
| `specifications` | json (list) | `[{label, value, group}]` |
| `videos` | json (list) | `[{title, provider, url}]` provider: `youtube`\|`vimeo` |
| `attribute_sets_id` | M2O → `attribute_sets` | |
| `title_prompt_id` | M2O → `prompts` | override manufacturer prompt |
| `description_prompt_id` | M2O → `prompts` | override manufacturer prompt |
| `items` | M2M → `items` via `products_items` | required — variants |
| `images` | files M2M → `directus_files` via `products_images` | |
| `documents` | files M2M → `directus_files` via `products_documents` | |
| `attributes` | M2M → `attributes` via `products_attributes` | |
| `collections` | M2M → `collections` via `collections_products` | |
| `cross_sells` | M2M → `products` via `products_cross_sells` | |
| `alternates` | M2M → `products` via `products_alternates` | |
| `repair_parts` | M2M → `products` via `products_repair_parts` | |

---

### `equipment`
Primary key: `id` (integer)

| Field | Type | Notes |
|-------|------|-------|
| `status` | string | `active` \| `inactive` |
| `serial_number` | string | required |
| `description` | string | required |
| `model` | string | |
| `sap_id` | integer | readonly — `OINS.insID` |
| `manufacturers_id` | M2O → `manufacturers` | required |
| `equipment_groups_id` | M2O → `equipment_groups` | required |
| `business_partners` | M2M → `business_partners` | |
| `repair_parts` | M2M → `products` via `equipment_repair_parts` | |
| `images` | files | via `equipment_images` |
| `documents` | files | via `equipment_documents` |

---

### `contacts`
Primary key: `id` (integer)

| Field | Type | Notes |
|-------|------|-------|
| `first_name` | string | required |
| `middle_name` | string | |
| `last_name` | string | |
| `job_title` | string | |
| `email_address` | string | |
| `phone_numbers` | M2M → `phone_numbers` | |

---

### `collections` (Product Collections / Categories)
Primary key: `id` (integer)

| Field | Type | Notes |
|-------|------|-------|
| `status` | string | `active` \| `draft` |
| `title` | string | required |
| `slug` | string | readonly, auto-generated |
| `nav_label` | string | required |
| `breadcrumb_label` | string | |
| `shopify_template` | string | `collection.json` \| `collection.brand.json` |
| `shopify_id` | integer | readonly |
| `description` | text | rich HTML |
| `nav_image_id` | M2O → `directus_files` | |
| `prompts_id` | M2O → `prompts` | product assignment prompt |
| `products` | M2M → `products` | |
| `attributes` | M2M → `attributes` | |
| `parent_pages` | M2M → `pages` | |
| `material_price_groups` | M2M → `material_price_groups` | |

---

### `directus_users` — SAP Custom Fields
The following custom fields were added for SAP session pool integration:

| Field | Type | Notes |
|-------|------|-------|
| `sap_service_layer_url` | string | Override per-user (falls back to `SAP_SERVICE_LAYER_URL` env) |
| `sap_company_db` | string | Override per-user (falls back to `SAP_COMPANY_DB` env) |
| `sap_username` | string | SAP login username |
| `sap_password` | string | AES-256-GCM encrypted via `enc:` prefix (Directus SECRET as key) |

---

## SAP ↔ Directus Field Mappings

### BusinessPartners (`OCRD`)
| SAP | Directus `business_partners` |
|-----|------------------------------|
| `CardCode` | `sap_id` (readonly) |
| `CardName` | `name` |
| `CardType` = `C` | `relationship_type` = `customer` |
| `CardType` = `S` | `relationship_type` = `supplier` |
| `Frozen` = `Y` | `status` = `inactive` |
| `Website` | `website` |

### Items (`OITM`)
| SAP | Directus `items` |
|-----|-----------------|
| `ItemCode` | `sku` (readonly) |
| `ItemName` | `description` |
| `Price` (Price List) | `offer_price` (readonly) |
| `Cost` | `base_cost` (readonly) |
| `List` | `mfr_list_price` |

### Equipment / Installed Items (`OINS`)
| SAP | Directus `equipment` |
|-----|---------------------|
| `insID` | `sap_id` (readonly) |
| `mfrSN` | `serial_number` |

---

## Existing Flows

| Name | Trigger | Status | Notes |
|------|---------|--------|-------|
| LS Business Partners | event filter items.create → `business_partners` | active | |
| Slugify Title on Create | event filter items.create → `collections`, `pages` | active | |
| Log New Collection Payload | event filter items.create → `collections` | active | |
| SM-584 | webhook | active | Redis error handling test |
| Rex Cron Test | webhook | active | |
| Rex Test Flow 1 | webhook | active | |
| Claude Test Flow | manual → `contacts` | inactive | |
| Uppercase Contact Names | event action → `contacts` | inactive | |
| Send Email When Title Changes | event filter → `collections` | inactive | |
| FORKED/MERGE Slug Generation | event filter → pages/collections | inactive | forked variants |

---

## Flow Building Patterns

### Event trigger (blocking filter — can modify payload)
```json
{
  "trigger": "event",
  "options": {
    "type": "filter",
    "scope": ["items.create"],
    "collections": ["business_partners"],
    "return": "operation_key"
  }
}
```

### Event trigger (non-blocking action — side effects)
```json
{
  "trigger": "event",
  "options": {
    "type": "action",
    "scope": ["items.create", "items.update"],
    "collections": ["business_partners"]
  }
}
```

### Data chain variables
- `{{ $trigger }}` — initial trigger payload
- `{{ $trigger.payload }}` — item data on event triggers
- `{{ $trigger.key }}` — item primary key
- `{{ $accountability.user }}` — acting user UUID
- `{{ $env.MY_VAR }}` — environment variable
- `{{ operation_key }}` — result of specific operation (preferred over `$last`)

### Common operation types
| Type | Purpose |
|------|---------|
| `item-create` | Create item in collection |
| `item-update` | Update item |
| `item-read` | Read/query items |
| `item-delete` | Delete items |
| `request` | HTTP request to external API |
| `mail` | Send email |
| `log` | Log a message |
| `exec` | Run JS code |
| `condition` | Branch on a condition |
| `trigger` | Call another flow |
| `transform` | Transform data with JSONata |
| `notification` | Send in-app notification |

---

## Key Rules
- **Never guess field names** — always use `mcp__directus__schema` first
- `directus_*` collections cannot be modified via items tool — use dedicated tools
- Delete requires explicit `keys` array — never delete by filter alone
- Junction collection names: `{singular}_{plural}` (e.g. `products_items`)
- All custom collections use integer PKs here (not UUID)
- SAP sync fields (`sap_id`, `shopify_id`) are always `readonly: true`
- Filter flows block the transaction — use `action` for async side effects
- Avoid `$last` in flows — use explicit `operationKey` references (breaks on reorder)

---

## Sources
- [Directus MCP Docs](https://directus.io/docs/guides/ai/mcp)
- [Directus v11.13 MCP Release](https://directus.io/blog/directus-v11-13-release)
- [Directus Changelog](https://directus.io/docs/releases/changelog)
