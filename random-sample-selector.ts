import { Papa } from "./papaparse.js"
import * as DOM from "./dom.ts"
import * as Table from "./table.ts"
import * as FileInput from "./fileinput.ts"
import * as Arr from "./array.ts"

type DataRow = Record<string, string>

type Data = {
	colnames: string[]
	data: DataRow[]
}

const parseData = (input: string): Data => {
	const parseResult = Papa.parse(input, { skipEmptyLines: true, dynamicTyping: false, header: true })
	const result: Data = { colnames: [], data: [] }
	if (parseResult.errors.length == 0) {
		result.data = parseResult.data
		if (result.data.length > 0) {
			result.colnames = Object.keys(result.data[0])
			for (const colname of result.colnames) {
                if (colname === "date" && !result.colnames.includes("month")) {
                    result.colnames.push("month")
                    for (const row of result.data) {
                        row.month = new Date(row.date).getMonth().toString()
                    }
                }
            }
		}
	} else {
		console.error("Error parsing data:", parseResult.errors)
	}
	return result
}

const main = () => {
	FileInput.createWholePageFileInput((event) => {
		const el = <HTMLInputElement>event.target
		const file = el.files?.[0]
		if (file !== null && file !== undefined) {
			file.text().then(onNewDataString)
		}
	})

	let data: Data = { colnames: [], data: [] }
	const groupBy: string[] = []

	const onNewDataString = (input: string) => {
		data = parseData(input)
		regenTableAndFilterInputs()
	}

	const regenTableAndFilterInputs = () => {
		DOM.removeChildren(groupBySwitchContainer)
		DOM.addEl(
			groupBySwitchContainer,
			DOM.createSwitch({
				type: "toggleMany",
				state: groupBy,
				opts: data.colnames,
				name: "groupBy",
				colors: {
					normal: "var(--color-background)",
					hover: "var(--color-background2)",
					selected: "var(--color-selected)",
				},
				onUpdate: refilterData,
				initOpen: true,
			})
		)

		refilterData()
	}

	const refilterData = () => {
        for (const groupCol of groupBy) {
            data.colnames = Arr.moveToFront(data.colnames, groupCol)
            data.data = data.data.sort((x, y) => x[groupCol] > y[groupCol] ? 1 : x[groupCol] < y[groupCol] ? -1 : 0)
        }

		const colspec: Record<string, Table.TableColSpec<DataRow>> = {}
		for (const colname of data.colnames) {
			const thisSpec: Table.TableColSpec<DataRow> = {}
			switch (colname) {
				case "strain":
					thisSpec.width = 300
					break
			}
			colspec[colname] = thisSpec
		}

		DOM.removeChildren(tableContainer)
		DOM.addEl(
			tableContainer,
			Table.createTableFromAos({
				aos: data.data,
				colSpecInit: colspec,
				defaults: { width: 150 },
				title: "Samples",
				getTableHeightInit: () => window.innerHeight / 2,
			})
		)
	}

	const mainEl = document.getElementById("main")!
	const tableContainer = DOM.addDiv(mainEl)
	const settingsContainer = DOM.addDiv(mainEl)
	settingsContainer.style.display = "flex"
	const groupBySwitchContainer = DOM.addDiv(settingsContainer)
	const howManyEl = DOM.addDiv(settingsContainer)
	howManyEl.style.display = "flex"
	howManyEl.style.flexDirection = "column"
	DOM.addEl(howManyEl, DOM.createDivWithText("per group"))
	DOM.addEl(howManyEl, DOM.createEl("input"))

	if (globalThis.window.location.hostname == "127.0.0.1") {
		const fetchAndUpdate = async (path: string) => {
			let fetchString = ""
			try {
				const resp = await fetch(path)
				if (resp.ok) {
					fetchString = await resp.text()
				}
			} catch (_error) {
				/* NOTE(sen) Ignore */
			}
			onNewDataString(fetchString)
		}

		fetchAndUpdate("/25JUL2022H3N2.tsv")
	}
}

main()
