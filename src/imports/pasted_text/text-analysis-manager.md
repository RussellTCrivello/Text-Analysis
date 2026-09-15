Complete

I need you to fully adhere to design principles to ensure the project can easily scale and support additional languages ​​in the future.
The data currently in the `extract.js` file needs to be extensible via the frontend; I do not want it to be hardcoded.
A key requirement is that the project must primarily support desktop environments.
Please build the project in its entirety while strictly maintaining proper design principles for both the code and functionality.
I need you to fully adhere to design principles to ensure the project can easily scale and support additional languages ​​in the future.
A key requirement is that the project must primarily support desktop environments.


Text Analysis 

Description
-----------
The "Text Analysis " is a comprehensive tool for organizing, analyzing, and reporting on data. The software provides a user-friendly interface for managing sources, content, and analysis processes, alongside robust capabilities for data import, export, and backup.

Features
--------
*   Source Management – ​​Organize and track sources
*   Content Management – ​​Store and categorize content
*   Content Analysis – Analyze and link related content
*   Comprehensive Reporting – Generate detailed reports and statistics
*   Multi-format Export – Export to Word, Excel, PDF, and more
*   Bilingual Support – Full interface in both Arabic and English
*   Printing Support – Professional print layouts with customizable headers
*   Backup and Restore – Protect your data via automatic backups
*   Attachment Management – ​​Link files to your research records

###  Standard Workflow

1.  **Sources** — Add your information sources (Name, Type, Link, Importance Level, Country, City, Description, etc.).
2.  **Contents** — Add content (Title, Text, Attachments, Importance Level, Date) and link each item to a specific source.
3.  **Analysis** — Add analytical data for each content item: Classification, People, Places, Coordinates, Stakeholders, and Date. ...manually, or extracted from the content itself for convenience and to make the software intelligent.

4. **All Data** — View collected data; filter by type (Source/Content/Analysis); search; use date filters; and utilize the "Quick View" or "Generate Report" features.

5. **Timeline** — View events/content in chronological order; click an event to view its details in the preview panel.

6. **Reports** — Run SQL queries or use the visual query builder; view results; add charts; customize report previews; and export (PDF, Excel, CSV, or print).

## User Interaction Summary

| Action | Location | What Happens |
|--------|--------|--------------|
| Add/Edit/Delete Records | Tabs: Sources, Content, Analysis | Dialog windows open; data is validated and saved to the database; the table updates. |
| Search | Data tab toolbar | Filters table rows based on text across columns. |
| Date Filtering | Toolbar (From/To) | Filters by date (Creation/Content/Analysis, depending on the tab). |
| Pagination | Below table tabs | Changes page or number of items per page; table displays the current page. |
| Export | "Export" button on toolbar or direct format buttons | Unified export window (column selection + format) or direct export (PDF/CSV/Excel/Word). |
| Print | Toolbar | Column Selection Window → Print Window. |
| Frequency / Statistics / Map / Compare / etc. | Tab-specific toolbar buttons | Each button activates a specific feature (e.g., record frequency, view statistics, open map, compare analyses). |
| Quick View / Preview | All data, timeline, contents | View the full record or event in a dialog window or side panel. |
| Reports | Reports Tab | Write SQL query or use visual builder → Execute → View results; add chart; set report title and options → Preview → Print/Export. |
| Settings | Tools → Settings | Change language, theme, font size, timeline density, and accessibility options; clicking "OK" applies changes and updates the UI. |
| Backup / Restore / Reset | Tools Menu | Backup/Restore or Reset window (with confirmation prompt); data is then reloaded. |
| Help / Shortcuts / About | Help Menu | Help window, keyboard shortcuts window, software information (About). |

---

##  Key Benefits

- **Centralized location** for sources, content, and analytics, replacing scattered files.
- **Organized data** (Sources → Contents → Analysis) with linked references and dates.
- **Search and filter tools** (text + date) and **pagination** to handle large datasets. - **Unified Export:** Allows column selection and supports multiple formats (PDF, Excel, Word, CSV, JSON, XML).
- **Timeline:** Displays the timing of events. - **Reports:** Supports custom SQL or visual queries, charts, and print/export options.
- **Multilingual User Interface:** (e.g., English, Arabic, Turkish) with Right-to-Left (RTL) support for Arabic.
- **Themes:** Light and dark mode options, plus **accessibility** features.
- **Backup and Restore:** To protect your data.
- **Audit Trail:** Tracks create, update, and delete operations in key tables (to ensure accountability).
- **No Internet Connection Required:** For basic usage; only the "View on Map" feature requires opening a browser.




# Key Functions

The "Text Analysis " program is divided into six main sections:

*   **Sources** — Manage your information sources.
*   **Contents** — Manage articles, notes, summaries, and other stored content.
*   **Analysis** — Record analyses associated with the content.
*   **All Data** — View sources, content, and analyses together.
*   **Timeline** — Explore time-stamped information in chronological order.
*   **Reports** — Prepare, print, and export reports.

Main menus provide additional functions such as settings, backup and restore, print options, import, and help.



# Section 1 — Sources

## Purpose

The **Sources** section is used to manage people, organizations, websites, publications, and other sources that provide information.

## Available Information

Each source can include information such as:

* Name
* Type
* Link
* Importance
* Country
* City
* Description
* Accounts
* Note
* Ownership
* Entry Date
* Creation Date
* Modification Date


You can control the number of records displayed at a time.

## Source Functions

| Function | Description |

| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

| **Add** | Create a new source. Enter the available information, then save it. |

| **Edit** | Modify the selected source. Select a source before using this function. |

| **Delete** | Remove the selected source after confirmation. |

| **Refresh** | Reload source records from the saved data. |

| **Export** | Allows you to select columns and format the output (e.g., PDF, Excel, Word, or CSV), then save the file. |

| **Print** | Allows you to select the columns to include before printing the list of sources. |

| **Search** | Filters the list of sources based on a word or phrase found in any column. |

| **Date Filter** | Specifies a time range for records using **From** and **To** dates. |

**Import Sources** | Imports multiple sources from an Excel file. The program attempts to match fields such as Name, Type, Link, Importance, Country, and City, and reports on imported records and any errors. |

**Duplicate** | Creates a copy of the selected source. The copy's name includes "(Copy)" until you change it. |

**Statistics** | Provides summary information such as the total number of sources, sources by type, sources by country, and average importance. |

## Source Columns

The list of sources can include the following:

**ID**, **Name**, **Type**, **Link**, **Importance**, **Country**, **City**, **Description**, **Accounts**, **Note**, **Ownership**, **Entry Date**, **Creation Date**, and **Modification Date**.

Column sizes can be adjusted as needed.


# Section 2 - Content

## Purpose

The **Content** section is used to manage articles, notes, summaries, and other research materials, and to link each item to its source.

# Creating Content

When adding content, you can specify the following:

*   Source
*   Title
*   Main text
*   Attachments
*   Note
*   Importance
*   Content date
*   Other relevant dates

Linking content to a source is important because it allows the software to associate the content with the person, organization, publication, or other source that provided it. You can search for an existing source or add a new one directly from the content addition interface.

# Content Functions

| Function | Action |

| **Add** | Create new content. Select the relevant source and enter the content details, or add a new source simultaneously. |

| **Edit** | Modify the selected content. |

| **Delete** | Remove the selected content after confirmation. |

| **Refresh** | Reload content records. |

| **Export** | Export selected columns to formats such as PDF, Excel, Word, or CSV. |

| **Print** | Select columns and print the content list. |

| **Search** | Filter the list using text-based search. |

| **Filter by Date** | Restrict records to a specific time range. |

| **Import Content** | Import multiple content records from an Excel file. The file must include information allowing each item to be linked to a source (e.g., Source ID or Source Name). The software attempts to match fields and generates a report on imported records and any errors. |

| **Copy** | Create a duplicate of the selected content. The copied title includes the phrase "(Copy)" until you change it. | **View Attachments** | Opens the attachment viewer for the selected content, if attachments are available. |
| **Link to Analysis** | Creates a new analysis linked to the selected content. This is useful when you want to analyze the content immediately after reviewing it. |
| **Preview Content** | Displays the full content record—including title, source, date, full text, and notes—without needing to edit. |

## Content Columns

The content list may include the following:

**ID**, **Source ID**, **Source Name**, **Title**, **Content Data**, **Importance**, **Attachments**, **Note**, **Content Date**, **Creation Date**, and **Modification Date**.



# Section 3 — Analysis

## Purpose

The **Analysis** section is used to record structured analyses of content.

The analysis may include the following:

*   Classification
*   People
*   Places
*   Coordinates
*   Parties involved
*   Analysis date

Each analysis is linked to a specific content item; users can search for content or add new content directly through the analysis interface. Extraction can be manual or automatic; the system is designed to intelligently extract people, places, and coordinates from the full-text content.

## Analysis Functions

| Function | Description |

| **Add** | Create a new analysis and link it to the selected content. |
| **Edit** | Modify the selected analysis. |
| **Delete** | Remove the selected analysis after confirmation. |
| **Refresh** | Reload analysis records. |
| **Export** | Export analysis records using available output formats and column options. |
| **Print** | Print information regarding the selected analysis. |
| **Search** | Filter the analysis list using text. |
| **Filter by Date** | Restrict analyses to a selected time range. |
| **Import Analysis** | Import multiple analyses from a CSV file containing information linking each analysis to the content. |
| **Duplicate** | Create a copy of the selected analysis to save as a separate record. |
| **Map View** | Open the geographic location associated with the selected analysis in your default web browser (when latitude and longitude coordinates are available). |
| **Compare** | Displays up to 10 analyses simultaneously, allowing you to compare fields such as classification, people, locations, coordinates, and involved parties. |
| **Summary** | Provides statistics such as the total number of analyses, classifications, unique people, unique locations, and analyses containing coordinates. |

## Analysis Columns

The list of analyses can include the following:

**ID**, **Content ID**, **Source Name**, **Classification**, **People**, **Locations**, **Coordinates**, **Involved Parties**, **Analysis Date**, **Creation Date**, and **Modification Date**.



# Section 4 — All Data

## Purpose

The **All Data** feature consolidates your sources, content, and analytics into a unified, read-only view.

You cannot add, edit, or delete data.


## Available Information

Records may include fields such as:

* Record type
* Source name
* Title
* Content data
* Classification
* Importance
* Content date
* Creation date
* Other relevant information

Records are color-coded by type to make them easier to distinguish.

## Available Functions

### Filter by Record Type

You can choose to view:

* All types
* Sources
* Content
* Analytics

### Search

Use text search to find matching information within the available records.

### Filter by Date

Select a time range to narrow down the displayed records.

### Quick View

Select a record and use the **Quick View** option to review all available details.

### Generate Report

Use the **Generate Report** option to create a report based on the current data.

### Record Preview

Selecting a record displays its details for review; the information in this section is read-only.

### View Full Details

You can open the selected record in full detail view to examine its information more closely.

### Export and Print

You can export or print the currently displayed data and choose which columns to include.

The output depends on the currently selected records and filters.


# Section 5 — Timeline

## Purpose
The **Timeline** organizes time-stamped information chronologically, allowing you to understand **what happened and when**.

It aggregates time-stamped information from the following sources:

* Sources
* Content items
* Analyses

Each event on the timeline represents a single record from one of these categories.

## Timeline Events

An event may include the following:

* Date and time
* Day of the week (if applicable)
* Title
* Summary
* Source
* People
* Locations
* Classification

Only records containing at least one usable date are included.

The software selects the most appropriate date for each record; for instance, it may use the content date or the analysis date when available.

## Using the Timeline

You can:

* Browse events in chronological order.
* Select an event to review its details.
* Search for specific information.
* Filter events by date, people, locations, or classification.
* Change the sorting method (e.g., switch the display order from newest to oldest or vice versa).
* View charts and statistics for the events included in the current filter.
* Print or export timeline information.

---

## Importance of the Timeline

The timeline helps you to:

* Determine the timing of significant events or records.
* Identify periods of intense activity.
* Spot gaps or periods with limited information.
* Compare information from different types of records within a unified chronological sequence.
* Start with an overview and then examine individual records in detail. ...allowing you to move from a comprehensive understanding of the subject matter to a detailed examination of specific events.

---

## Timeline Statistics

The timeline provides summary statistics regarding the available events.

### Total

The total number of events available in the timeline.

### Filtered

The number of events remaining after applying current filters.

### Sources

The number of events based on source records.

### Analytics

The number of events based on analytics records.

Remaining events are based on content records.

These values ​​update when filters change, making it easy to understand the volume of information currently being examined. ---

## Timeline Filters

### Time Range

Use the **From** and **To** dates to specify the time period in question.

For example, you can focus on:

*   A single month
*   A single year
*   A specific historical period
*   A timeframe between two known events

### Search

The search tool can scan information such as:

*   Titles
*   Content text
*   Categories
*   People
*   Places
*   Source names

Only matching events remain in the filtered results.

### People

Select a person from the available list to view events associated with that individual.

### Places

Select a place to view events associated with that location.

Information may be derived from analytics data or from the city or country associated with the source.

### Category

Select a category to view events associated with that category.

### Clear

Clear active filters to return to the broader set of events.

Filters work in conjunction with one another; an event must meet **all active conditions** to remain visible. For example, you can combine:

*   A time range
*   A specific person
*   A specific category

This allows you to focus on a very specific set of events. ---

## Timeline Sorting

The timeline can be sorted by:

*   Date
*   People
*   Locations
*   Category
*   Source

You can also choose the display order:

*   **Newest first** — displays new events first.
*   **Chronological order** — displays older events first.

The selected sort order applies to the chosen classification method.

---

## Timeline Charts

Charts summarize events that match the current filters.

Available chart types may include:

### Timeline / Event Distribution Over Time

Displays the number of events occurring on each date.

This can reveal periods of increased or decreased activity.

### Event Distribution by Type

Shows the number of events falling under the following categories:

*   Sources
*   Content
*   Analytics

### Activity by Day of the Week

Shows the number of events occurring on each day of the week.

This helps identify recurring patterns.

### Monthly Grouping

Groups events by month.

This is useful for identifying long-term trends.

### Classification Distribution

Shows the number of events belonging to each classification.

This helps identify the most common topics or categories.

The chart always reflects the currently filtered data; when filters are changed, the chart updates to match the new selection.

---

## Timeline Analysis

The timeline also provides a text-based summary of the filtered information. The summary may include:

*   Total number of events
*   Breakdown by record type
*   Counts and percentages
*   Most common categories
*   Most active period

For example, the summary might identify the five most frequent categories and the percentage of events associated with each.

This provides a quick overview of the same information shown in the chart.

---

## Event Cards and Details

Each event card can display the following information:

*   Date
*   Title
*   Summary
*   Source
*   People
*   Places
*   Category

Selecting an event allows you to view its full details.

When there is a large number of events, pagination can be used to navigate through the results and control the number of events displayed at once.

---

## Timeline Display Density

Timeline cards can use one of three display density levels:


## Timeline Display Density

Timeline cards can use one of three display density levels:

* **Compact** — Displays a larger number of events simultaneously.
* **Comfortable** — Balances the amount of information with whitespace.
* **Expansive** — Provides more space for each event.

The selected density level can also be changed via **Settings**.

---

## Printing and Exporting the Timeline

### Printing

Printing generates a copy of the timeline information and event layout.

Standard printing can also be used to save the output as a PDF, provided the selected printer or print dialog supports this feature.

### Exporting

Timeline information can be exported to:

* Word
* Excel
* PDF

You can choose the export range:

* **Current Page** — Only the events currently displayed.
* **All (Filtered)** — All events matching the current filters.
* **All Data** — All timeline events, regardless of current filters.

The **All (Filtered)** option is useful when preparing a report based on a specific subset of your research.

---

## Timeline Features

The timeline offers the following:

* A chronological view of dated sources, content, and analyses.
* Statistics showing totals and record types.
* Charts illustrating activities and categories.
* Filters for dates, people, places, and categories.
* Sorting capabilities based on various useful fields.
* Detailed event review.
* Flexible printing and export options.

# Settings

The **Settings** area controls the program's behavior and how information is displayed. ## Language

You can select the interface language, such as:

* English
* Arabic
* Turkish

When Arabic is selected, the program uses a **right-to-left** layout and updates labels and menus accordingly.

## Theme (Appearance)

Choose:

* Light
* Dark

## Font Size

Adjust the text size, for example, between **8 and 16 points**.

## Timeline Density

Choose:

* Compact
* Comfortable
* Expansive

Other settings, such as accessibility options, may also be available depending on the program version.

Accessibility features may include:

* Contrast options
* Keyboard support
* Screen reader support

The **Keyboard Shortcuts** help page lists the available shortcut keys.

Once settings are confirmed, the selected options are saved and applied throughout the program.

---

# Other Tools

The program provides additional tools for managing data and the application itself.

| Tool | Function |
| :--- | :--- |
| **Backup and Restore** | Create backups of your data or restore data from a previous backup. |
| **Reset** | Reset data or specific parts of the program after confirmation. Please use this tool with caution. |
| **Print Settings** | Control general printing options such as headers and page layout. |
| **Attachment Management** | Allows you to view, add, remove, or open attachment files linked to your content. |
| **Import Data** (**Ctrl+I**) | Import data from a file (such as an Excel file). You can choose whether the data falls under the category of Sources, Content, or Analyses. |
| **Performance Monitor** | Provides technical information regarding application performance, data size, and other relevant details. This tool is primarily useful for troubleshooting. |

---

# Data Backup, Restore, and Transfer

The "Text Analysis " software stores your data on your computer. You can use the **Backup and Restore** feature to protect your information, restore previous data, or transfer the dataset itself to another computer.

The backup can include the following:

* Sources
* Content
* Analyses

You can create a backup in a single file, copy that file to another location, and restore it when needed.


## Creating a Backup

1. Open the **Backup & Restore** section.

2. Select **Create backup**.
3. Confirm the operation when prompted.
4. Wait for the success message to appear.
5. Note the location and filename of the backup file.
6. Copy the backup file to a secure location, such as a USB drive, a cloud folder, or another computer.

The backup file might have a name similar to this:

`backup_manual_20250220_143022.sqlite`

The actual filename depends on the date and time the backup was created.

### Recommended Practice

Create backups regularly (e.g., once a week) to ensure an up-to-date copy of your research data is always available.

---

# Restoring Existing Data

If backups of the software are already available:

1. Open the **Backup & Restore** section.
2. Review the available backup records.
3. Select the backup you wish to use.
4. Choose either **Restore** or **Merge**.

### Restore

The **Restore** option replaces current data with the data contained in the selected backup.

Existing data may be replaced (overwritten); therefore, use this option only when you are certain that the backup contains the information you wish to restore.

### Merge

The **Merge** option adds the backup data to your current information. Nothing is intentionally removed from the current dataset; instead, the sources, content, and analyses found in the backup are added to the existing data.

After restoring the data, the program may recommend restarting to ensure all information loads correctly.

---

# Restoring from a Backup File

You can also restore from a backup file copied from another computer, a USB drive, the Downloads folder, or any other location.

1. Open the **Backup and Restore** section.
2. Select **Restore from file** or **Import backup**.
3. Select the backup file.
4. Open the file.
5. Allow the program to verify the backup.
6. Review the backup information, such as the number of sources, content items, and analyses, as well as the file size.
7. If the option is available, choose whether you want to copy the imported backup file to the program's backup collection.
8. Select **Restore** or **Merge**.
9. Confirm the operation.
10. Wait for the success message to appear.
11. Restart the program after the restoration process is complete, if prompted.

### Copying to the Backup Folder After Import

If the imported file is not already located within the program's backup collection, the program may offer an option labeled **Copy to backup folder after import**.

When this option is enabled, the program keeps a copy in its backup collection so it can be used again later. ---

# Transferring Your Data to Another Computer

## On the Original Computer

1. Launch the "Text Analysis " software. 2. Open the **Backup & Restore** section.
3. Select **Create backup**.
4. Confirm the operation.
5. Wait for the success message to appear.
6. Note the location of the backup file.
7. Copy the backup file to a USB drive, cloud storage service, or another transfer medium.

## On the New Computer

1. Install the "Text Analysis " software if necessary.
2. Copy the backup file to an easily accessible location.
3. Launch the "Text Analysis " software.
4. Open the **Backup & Restore** section.
5. Select **Restore from file**.
6. Select the transferred backup file.
7. Review the backup information.
8. Decide whether to keep a copy in the software's backup collection (if this option is available).
9. Select **Restore** to replace the current data with the transferred dataset.
10. Confirm the operation.
11. Restart the software after the restoration process is complete.

The new computer will then contain the sources, content, and analyses included in the transferred backup.