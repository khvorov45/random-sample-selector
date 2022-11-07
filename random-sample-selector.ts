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
			result.colnames = ["_SEL_"].concat(Object.keys(result.data[0]))
			for (const colname of result.colnames) {
				if (colname === "date") {
					if (!result.colnames.includes("month")) {
						result.colnames.push("month")
						for (const row of result.data) {
							row.month = new Date(row.date).getMonth().toString()
						}
					}
					if (!result.colnames.includes("year")) {
						result.colnames.push("year")
						for (const row of result.data) {
							let year = new Date(row.date).getFullYear()
							if (isNaN(year)) {
								year = parseInt(row.date.slice(0, 4))
							}
							row.year = year.toString()
						}
					}
				}
			}
			for (const row of result.data) {
				row._SEL_ = "0"
			}
		}
	} else {
		console.error("Error parsing data:", parseResult.errors)
	}
	return result
}

const main = () => {
	const fileInputHandler = (event: Event) => {
		const el = <HTMLInputElement>event.target
		const file = el.files?.[0]
		if (file !== null && file !== undefined) {
			file.text().then(onNewDataString)
		}
	}
	FileInput.createWholePageFileInput(fileInputHandler)

	let data: Data = { colnames: [], data: [] }
	const keepAll: Record<string, string[]> = {}
	const groupBy: string[] = []

	const onNewDataString = (input: string) => {
		data = parseData(input)
		regenTableAndFilterInputs()
		settingsContainer.style.display = "flex"
		filePromptContainer.style.display = "none"
	}

	const regenTableAndFilterInputs = () => {
		const switchColors = {
			normal: "var(--color-background)",
			hover: "var(--color-background2)",
			selected: "var(--color-selected)",
		}

		DOM.removeChildren(keepAllSwitchesContainer)
		for (const colname of data.colnames) {
			if (colname !== "_SEL_") {
				if (keepAll[colname] === undefined) {
					keepAll[colname] = []
				}
				DOM.addEl(
					keepAllSwitchesContainer,
					DOM.createSwitch({
						type: "toggleMany",
						state: keepAll[colname],
						opts: Arr.unique(data.data.map((x) => x[colname])).sort(Arr.generalSort),
						name: colname,
						colors: switchColors,
						onUpdate: reselectData,
					})
				)
			}
		}

		DOM.removeChildren(groupBySwitchContainer)
		DOM.addEl(
			groupBySwitchContainer,
			DOM.createSwitch({
				type: "toggleMany",
				state: groupBy,
				opts: data.colnames.filter((x) => x !== "_SEL_"),
				name: "groupBy",
				colors: switchColors,
				onUpdate: reselectData,
				initOpen: true,
			})
		)

		reselectData()
	}

	const reselectData = () => {
		for (const groupCol of groupBy) {
			data.colnames = Arr.moveToFront(data.colnames, groupCol)
		}
		data.colnames = Arr.moveToFront(data.colnames, "_SEL_")

		const dataGroups = Arr.summarise({
			data: data.data,
			groups: groupBy,
			defaultCounts: () => <DataRow[]>[],
			getKey: (row, group) => row[group],
			addRow: (row, count) => count.push(row),
		})

		let totalSelectedCount = 0

		const select = (from: any) => {
			if (Array.isArray(from)) {
				const notKept = <DataRow[]>[]
				for (let rowIndex = 0; rowIndex < from.length; rowIndex++) {
					const row = from[rowIndex]
					let keepBecauseOfKeepAll = false
					for (const colname of data.colnames) {
						if (colname !== "_SEL_") {
							keepBecauseOfKeepAll = keepBecauseOfKeepAll || keepAll[colname].includes(row[colname])
							if (keepBecauseOfKeepAll) {
								break
							}
						}
					}
					if (keepBecauseOfKeepAll) {
						row._SEL_ = "1"
						data.data.push(row)
						totalSelectedCount += 1
					} else {
						notKept.push(row)
					}
				}

				const selectCount = howManyInput.value === "" ? 0 : <number>(<unknown>howManyInput.value)
				const allIndices = Arr.seq(0, notKept.length, 1)
				const selectedIndices = Arr.sample(allIndices, selectCount)
				for (let rowIndex = 0; rowIndex < notKept.length; rowIndex++) {
					const row = notKept[rowIndex]
					const sel = selectedIndices.includes(rowIndex)
					if (sel) {
						totalSelectedCount += 1
					}
					row._SEL_ = sel ? "1" : "0"
					data.data.push(row)
				}
			} else {
				for (const key of Object.keys(from)) {
					select(from[key])
				}
			}
		}

		data.data.length = 0
		select(dataGroups)

		const colspec: Record<string, Table.TableColSpec<DataRow>> = {}
		for (const colname of data.colnames) {
			const thisSpec: Table.TableColSpec<DataRow> = {}
			switch (colname) {
				case "strain":
					thisSpec.width = 300
					break
				case "_SEL_":
					thisSpec.width = 70
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

		DOM.removeChildren(totalSelectedContainer)
		DOM.addEl(totalSelectedContainer, DOM.createDivWithText(`total selected: ${totalSelectedCount}`))
	}

	const mainEl = document.getElementById("main")!
	const tableContainer = DOM.addDiv(mainEl)
	const settingsContainer = DOM.addDiv(mainEl)
	settingsContainer.style.display = "none"
	const keepAllContainer = DOM.addDiv(settingsContainer)
	DOM.addEl(keepAllContainer, DOM.createDivWithText("keepAll"))
	const keepAllSwitchesContainer = DOM.addDiv(keepAllContainer)
	const groupBySwitchContainer = DOM.addDiv(settingsContainer)
	const howManyEl = DOM.addDiv(settingsContainer)
	howManyEl.style.display = "flex"
	howManyEl.style.flexDirection = "column"
	DOM.addEl(howManyEl, DOM.createDivWithText("per group"))
	const howManyInput = DOM.addEl(howManyEl, DOM.createEl("input"))
	howManyInput.name = "test"
	howManyInput.type = "number"
	howManyInput.oninput = reselectData
	const totalSelectedContainer = DOM.addDiv(settingsContainer)
	const filePromptContainer = DOM.addDiv(mainEl)
	filePromptContainer.style.display = "flex"
	filePromptContainer.style.justifyContent = "center"
	filePromptContainer.style.alignItems = "center"
	filePromptContainer.style.height = "100vh"
	filePromptContainer.style.fontSize = "xx-large"

	DOM.addEl(filePromptContainer, DOM.createDivWithText("Drag file"))

	const fileInputWholePageClick = DOM.addEl(filePromptContainer, DOM.createEl("input"))
	fileInputWholePageClick.type = "file"
	fileInputWholePageClick.addEventListener("change", fileInputHandler)
	fileInputWholePageClick.style.position = "fixed"
	fileInputWholePageClick.style.top = "0"
	fileInputWholePageClick.style.left = "0"
	fileInputWholePageClick.style.width = "100vw"
	fileInputWholePageClick.style.height = "100vh"
	fileInputWholePageClick.style.opacity = "0"
	fileInputWholePageClick.style.visibility = "visible"
	fileInputWholePageClick.style.zIndex = "999"
	fileInputWholePageClick.style.background = "gray"
	fileInputWholePageClick.style.cursor = "pointer"

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
