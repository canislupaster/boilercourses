import { Card } from "@/components/card";
import { Alert, MoreButton, simp } from "@/components/clientutil";
import { Footer } from "@/components/footer";
import { LogoBar } from "@/components/logo";
import { Button, ButtonPopover, Divider, IconButton, Loading, selectProps, Text, textColor } from "@/components/util";
import { APICallResult, AppCtx, useAPIResponse, useInfo } from "@/components/wrapper";
import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { Pagination } from "@heroui/pagination";
import { Slider } from "@heroui/slider";
import { IconArrowUp, IconFilterFilled, IconMoodLookDown, IconX } from "@tabler/icons-react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Collapse } from 'react-collapse';
import Select, { Props as SelectProps } from 'react-select';
import { twMerge } from "tailwind-merge";
import { formatTerm, latestTermofTerms, ServerSearch, Term, termIdx } from "../../shared/types";
import attributeToGenEd from "./attributeToGenEd.json";

export type SearchState = {
	query: string,
	minCredits?: number, maxCredits?: number
	attributes: string[],
	minCourse?: number, maxCourse?: number,
	subjects: string[], terms: Term[],
	scheduleType: string[],
	minGPA?: number, maxGPA?: number,
	minMinute?: number, maxMinute?: number,
	page: number,
	instructors: string[]
};

const defaultSearchState: SearchState = {
	query: "", attributes: [], subjects: [], scheduleType: [], terms: [], page: 0, instructors: []
};

const spec: Partial<Record<keyof SearchState, "array"|"number"|"string">> = {
	query: "string", minCredits: "number", maxCredits: "number",
	attributes: "array", minCourse: "number", maxCourse: "number",
	subjects: "array", terms: "array", scheduleType: "array", page: "number",
	minGPA: "number", maxGPA: "number", minMinute: "number", maxMinute: "number"
};

function encodeToQuery(x: object) {
	const u = new URLSearchParams();
	for (const [k,v] of Object.entries(x)) {
		if (typeof v=="string") u.append(k,v);
		else if (typeof v=="number") u.append(k,v.toString());
		else if (Array.isArray(v))
			for (const el of v as string[]) u.append(k,el);
	}
	return u;
}

function decodeFromQuery<T extends object>(x: URLSearchParams, spec: Partial<Record<keyof T, "array"|"number"|"string">>, base: T) {
	for (const k in spec) {
		const g = x.getAll(k);
		//@ts-expect-error
		if (spec[k]=="array") base[k]=[...base[k], ...g];
		//@ts-expect-error
		else if (spec[k]=="number" && g.length>0) base[k]=Number(g[0]);
		//@ts-expect-error
		else if (g.length>0) base[k]=g[0];
	}
}

export function encodeSearchState(state: Partial<SearchState>) {
	return encodeToQuery({...state,
		page: state.page==undefined || state.page==0 ? undefined : state.page+1});
}

export function decodeQueryToSearchState(query: URLSearchParams) {
	const x = {...defaultSearchState, page: 1};
	decodeFromQuery(query,spec,x);
	x.page--;
	return x;
}

function SearchResults({api, page, terms, filtering, setPage, searchInput}: {
	api: APICallResult<SearchState, ServerSearch>|null, page: number,
	filtering: boolean, terms: Term[], setPage: (x: number)=>void,
	searchInput: React.RefObject<HTMLInputElement>
}) {
	const [scrollToTop, setScrollToTop] = useState(false);
	const resultsRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const onScroll = () => {
			if (resultsRef.current!==null)
				setScrollToTop(window.scrollY>resultsRef.current.offsetTop+400);
		};

		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
  }, []);

	const [active, setActive] = useState<number|null>(null);
	const resultsList = useRef<HTMLDivElement>(null);
	const {goto} = useContext(AppCtx);

	const res = api?.res;
	const resWithTerms = useMemo(()=>{
		if (!res || res.results.length==0) return null;
		return res.results.map(r=>({
			...r,
			term: terms.length==0 ? undefined
				: latestTermofTerms(Object.keys(r.course.termInstructors) as Term[], terms) ?? undefined
		}));
	}, [res, terms]);

	useEffect(()=>{
		setActive(null);
		if (!resWithTerms) return;
		const len = resWithTerms.length;
		
		let cur: number|null=null;
		const cb = (ev: KeyboardEvent) => {
			const navKeys = ["ArrowUp", "ArrowDown", "Tab"];

			if (ev.target==searchInput.current && navKeys.includes(ev.key)) {
				searchInput.current?.blur();
			} else if (ev.target!=document.body) {
				setActive(null);
				cur=null;
				return;
			}

			if (ev.key=="Enter" && cur!=null) {
				ev.preventDefault();

				let url = `/course/${resWithTerms[cur].course.id}`;
				if (resWithTerms[cur].term) url+=`?term=${resWithTerms[cur].term}`;
				goto(url);
				return;
			} else if (!navKeys.includes(ev.key)) {
				if (/^[A-Za-z0-9 ]{1}$/.test(ev.key)) searchInput.current?.focus();
				return;
			}

			const up = ev.key=="ArrowUp" || (ev.key=="Tab" && ev.shiftKey);
			ev.preventDefault();

			if (cur==null) {
				const f = [...resultsList.current!.children].findIndex(x=>{
					return x.getBoundingClientRect().top>=0;
				});

				setActive(cur = f==-1 ? null : f);
			} else {
				cur = ((up ? cur-1 : cur+1)+len)%len;
				resultsList.current!.children[cur].scrollIntoView({block: "center"});
				setActive(cur);
			}
		};

		window.addEventListener("keydown", cb);
		return () => {
			window.removeEventListener("keydown", cb);
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [goto, resWithTerms]);

	return <div className="contents" ref={resultsRef} >
		{api==null || api.req!.page!=page ? <Loading/> : (api.res.results.length>0 ? //:)
				<>
					<div className="flex flex-col pb-8" ref={resultsList} >
						{resWithTerms!.map((x,i) => <Card key={`${x.course.id}\n${x.course.varTitle}`}
							term={x.term} score={x.score}
							course={x.course} type="list" selected={i==active} />)}
					</div>
					<div className="w-full flex flex-col items-center" >
						<Pagination total={api.res.npage} initialPage={api.req!.page+1} onChange={
							(page) => setPage(page-1)
						} ></Pagination>
					</div>
				</>
				:
				<div className='flex flex-col h-full w-full items-center justify-center align-center gap-2 mt-5 mb-11'>
					<IconMoodLookDown size={50} color='#DAAA00' />
					<Text v="bold" >No results found!</Text>
					{filtering && <Text v="sm" >Maybe try changing the filters?</Text>}
				</div>)}

		{scrollToTop && <IconButton className="fixed z-50 w-12 h-12 rounded-full right-12 bottom-20 dark:shadow-black shadow-white shadow-sm move-in-bottom group"
			onClick={() => window.scrollTo({ behavior: "smooth", top: 0 })} 
			icon={<IconArrowUp className="mx-auto my-auto group-hover:-translate-y-0.5 transition" />} />}
	</div>;
}

export function Search({init, autoFocus, clearSearch, setSearchState, includeLogo}: {
	init: Partial<SearchState>, autoFocus?:boolean,
	clearSearch?: ()=>void, setSearchState: (s:SearchState)=>void,
	includeLogo?: boolean
}) {
	const searchState = useMemo(()=>({...defaultSearchState, ...init}), [init]);
	const info = useInfo();

	const sortedTerms = useMemo(()=>
		Object.keys(info.terms).map(k=>({k: k as Term, idx: termIdx(k as Term)}))
			.sort((a,b) => b.idx-a.idx), [info.terms]);

	const mod = (x: Partial<SearchState>) => {
		setSearchState({...searchState, page: 0, ...x});
	};

	const multiSelectProps = <T extends {value: string}>(
		k: "attributes"|"subjects"|"terms", options: T[]
	): SelectProps<T, true> => {
		const obj = Object.fromEntries(options.map(x => [x.value,x]));

		return {
			...selectProps<T, true>(),
			options, isMulti: true,
			value: searchState[k].map(x=>obj[x]),
			onChange: (ks: unknown)=>mod({[k]: (ks as typeof options).map(x=>x.value)})
		};
	};

	const renderRange = (a?: number, b?: number) =>
		a!=undefined ? (b!=undefined ? `${a} - ${b}` : `${a}+`) : (b!=undefined ? `up to ${b}` : undefined);
	const renderTime = (x: number) => {
		let h = Math.floor(x/60);
		const m=Math.round(x)%60;
		if (h==24) h=0;
		const h2 = (h+11)%12 +1, m2=m<10 ? `0${m}` : m;
		return `${h2}:${m2} ${h>=12 ? "p" : "a"}m`;
	};
	const renderTimeRange = (a?: number, b?: number) =>
		a!=undefined ? (b!=undefined ? `${renderTime(a)} - ${renderTime(b)}` : `after ${renderTime(a)}`)
			: (b!=undefined ? `before ${renderTime(b)}` : undefined);

	const api = useAPIResponse<ServerSearch,SearchState>("search", {data: searchState, method: "POST", debounceMs: 100});

	const cond = api!=null && api.res.npage<=searchState.page && !api.loading;
	useEffect(() => {
		if (cond) setSearchState({...searchState, page: api.res.npage-1});
	}, [api?.res.npage, cond, searchState, setSearchState]);

	const cond2 = api!=null && api.loading==false;
	const {restoreScroll} = useContext(AppCtx);
	useEffect(()=>{
		if (cond2) restoreScroll();
	}, [cond2, restoreScroll]);

	const activeFilters=[];
	if (searchState.minCourse!=undefined || searchState.maxCourse!=undefined) activeFilters.push("level");
	if (searchState.minCredits!=undefined || searchState.maxCredits!=undefined) activeFilters.push("credits");
	if (searchState.minGPA!=undefined || searchState.maxGPA!=undefined) activeFilters.push("GPA");
	if (searchState.minMinute!=undefined || searchState.maxMinute!=undefined) activeFilters.push("time");
	if (searchState.scheduleType.length>0) activeFilters.push("schedule");
	if (searchState.attributes.length>0) activeFilters.push("attributes");
	if (searchState.terms.length>0) activeFilters.push("semester");
	if (searchState.subjects.length>0) activeFilters.push("subject");

	const [filtersCollapsed, setFiltersCollapsed] = useState(true);
	const inputRef = useRef<HTMLInputElement>(null);

	return <>
		{includeLogo && <LogoBar onClick={clearSearch} />}

		<div className="mb-3" >
			<input
				ref={inputRef}
				maxLength={info.searchLimit}
				autoFocus={autoFocus} id="search" type="text"
				placeholder="Search for courses..."
				value={searchState.query}
				onChange={(e) => mod({query: e.target.value})}
				className={`text-xl bg-transparent w-full pb-2 border-b-2 focus:outline-none focus:border-blue-500 transition duration-300 ${textColor.contrast}`}
			/>
		</div>
		<div className={`flex flex-col mb-3 ${filtersCollapsed ? "" : "gap-2"} justify-center w-full items-stretch`} >
			<Collapse isOpened={!filtersCollapsed} >
				<div className="flex flex-col gap-2 w-full items-stretch" >
					{/* 🤮 */}
					<Select placeholder="Subject..." components={{Option: (props) =>
							<div className={twMerge(props.getClassNames("option", props), "flex flex-row items-stretch justify-start py-0")}
								key={props.data.value} onClick={() => props.selectOption(props.data)} >
								<span className="basis-14 shrink-0 py-2" >{props.data.abbr}</span>
								<Divider className="h-7" />
								<span className="py-2" >{props.data.name}</span>
							</div>
						}}
						filterOption={(option, query) => {
							const sq = simp(query);
							const nameMatch = simp(option.data.name).includes(sq);
							const abbrMatch = simp(option.data.abbr).startsWith(sq);

							if (abbrMatch) return !option.data.v;
							else return !abbrMatch && nameMatch && option.data.v;
						}}
						getOptionLabel={x => `${x.abbr} - ${x.name}`}
						getOptionValue={x => `${x.abbr}\n${x.v}`}
						{...multiSelectProps<{
							abbr: string, name: string, value: string, v: boolean
						}>("subjects", [
							...info.subjects.map(x=>({...x, v: false, value: x.abbr})),
							...info.subjects.map(x=>({...x, v: true, value: x.abbr}))
						])}
					/>
					<Select placeholder="Semester..."
						{...multiSelectProps("terms", sortedTerms.map(x => ({
							label: formatTerm(x.k), value: x.k
						})))}
						/>
					<Select placeholder="Gen Ed..."
						{...multiSelectProps("attributes", Object.entries(attributeToGenEd).map(([k,v]) => ({
							label: v, value: k
						})))}
					/>
					{searchState.attributes.length>0 && <Alert txt="Not all geneds may appear since they are based on catalog attributes which seem to be incomplete. Consider consulting your college's site for an accurate list." />}
				</div>
			</Collapse>
			
			<Collapse isOpened >
				<div className="flex flex-col md:flex-row justify-between items-end w-full gap-2 flex-wrap" >
					{!filtersCollapsed ? <div className="flex flex-row items-stretch gap-2 flex-1 md:flex-none flex-wrap" >
						<ButtonPopover title="Credits" desc={renderRange(searchState.minCredits, searchState.maxCredits)} >
							<Slider label="Credit range"
								step={1} minValue={1} maxValue={18}
								showSteps showTooltip defaultValue={
									[searchState.minCredits ?? 1, searchState.maxCredits ?? 18]
								}
								onChange={(x) => {
									const [a,b] = x as [number,number];
									mod({minCredits: a==1 ? undefined : a, maxCredits: b==18 ? undefined : b})
								}}
								getValue={(x)=>{
									const [a,b] = x as [number,number];
									return `${a} - ${b} credits`;
								}}
								className="min-w-56"
							/>
						</ButtonPopover>

						<ButtonPopover title="Level" desc={renderRange(searchState.minCourse, searchState.maxCourse)} >
							<Slider label="Course range"
								step={100} minValue={100} maxValue={900}
								showSteps showTooltip defaultValue={
									[searchState.minCourse ?? 100, searchState.maxCourse ?? 900]
								}
								onChange={(x) => {
									const [a,b] = x as [number,number];
									mod({minCourse: a==100 ? undefined : a, maxCourse: b==900 ? undefined : b})
								}}
								getValue={(x)=>{
									const [a,b] = x as [number,number];
									return `${a} - ${b}`;
								}}
								className="min-w-56"
							/>
						</ButtonPopover>

						<ButtonPopover title="Time" desc={renderTimeRange(searchState.minMinute, searchState.maxMinute)} >
							<p className="mb-3" >Latest semester section time</p>
							<Slider
								aria-label="Latest semester section time"
								step={15} minValue={5*60} maxValue={24*60}
								marks={[...new Array<void>(5)].map((x,i)=> {
									const v = 60*((24-5)*i/4+5);
									return { label: renderTime(v), value: v};
								})}
								onChange={(x) => {
									const [a,b] = x as [number,number];
									mod({minMinute: a==5*60 ? undefined : a, maxMinute: b==24*60 ? undefined : b})
								}}
								defaultValue={[searchState.minMinute ?? 5*60, searchState.maxMinute ?? 24*60]}
								getValue={(x)=>{
									const [a,b] = x as [number,number];
									return `${renderTime(a)} - ${renderTime(b)}`;
								}}
								className="min-w-80 text-nowrap px-1"
							/>
						</ButtonPopover>

						<ButtonPopover title="GPA" desc={renderRange(searchState.minGPA, searchState.maxGPA)} >
							<Slider label="Average GPA"
								step={0.05} minValue={1} maxValue={4}
								showTooltip
								onChange={(x) => {
									const [a,b] = x as [number,number];
									mod({minGPA: a==1 ? undefined : a, maxGPA: b==4 ? undefined : b})
								}}
								defaultValue={[searchState.minGPA ?? 1, searchState.maxGPA ?? 4]}
								getValue={(x)=>{
									const [a,b] = x as [number,number];
									return `${a.toFixed(2)} - ${b.toFixed(2)}`;
								}}
								className="min-w-56 mb-3"
							/>
							<p>Averaged over all sections in dataset.</p>
						</ButtonPopover>

						<ButtonPopover title="Schedule" desc={
							searchState.scheduleType.length>0
							? `${searchState.scheduleType.length} of ${info.scheduleTypes.length} types` : undefined
						} >
							<CheckboxGroup
								label="Choose schedules"
								value={searchState.scheduleType}
								onChange={x => mod({scheduleType: x})}
							>
								<div className="flex flex-row w-full gap-3" >
									<Button onClick={() => mod({scheduleType: info.scheduleTypes})} className="flex-1" >All</Button>
									<Button onClick={() => mod({scheduleType: []})}
										className="flex-1" >None</Button>
								</div>
								{info.scheduleTypes.map(x =>
									<Checkbox value={x} key={x} checked={searchState.scheduleType.includes(x)} >{x}</Checkbox>)}
							</CheckboxGroup>
						</ButtonPopover>
						{activeFilters.length>0 && <Button icon={<IconX/>} onClick={()=>{
							setSearchState({
								...defaultSearchState,
								instructors: searchState.instructors,
								query: searchState.query
							});
						}} >
							Clear
						</Button>}
					</div> : <Button icon={<IconFilterFilled/>} onClick={() => setFiltersCollapsed(false)} className="w-full md:w-auto" >
						{activeFilters.length>0 ? `Filtering by ${activeFilters.join(", ")}` : "Filters"}
					</Button>}
					{api!=null && <p>
						{api.res.numHits} results in {api.res.ms.toFixed(2)} ms (page {api.req!.page+1} of {api.res.npage})
					</p>}
				</div>

				{!filtersCollapsed && <MoreButton act={()=>setFiltersCollapsed(true)} >
					Hide filters
				</MoreButton>}
			</Collapse>
		</div>

		<SearchResults api={api} page={searchState.page} setPage={(page)=>mod({page})}
			filtering={activeFilters.length>0} terms={searchState.terms}
			searchInput={inputRef} />

		{includeLogo && <Footer />}
	</>;
}