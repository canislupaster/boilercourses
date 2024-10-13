"use client"

import { IconBrandGithubFilled, IconInfoCircleFilled } from "@tabler/icons-react";
import { useContext } from "react";
import { twMerge } from "tailwind-merge";
import { Anchor, Text } from "./util";
import { AppCtx } from "./wrapper";

function InfoModal() {
	return <div className="pt-5 flex flex-col gap-3" >
		<p>Thank you for trying BoilerCourses, a fork/rewrite of <Anchor href="https://boilerclasses.com" >BoilerClasses</Anchor> by <Anchor href="https://www.sarthakmangla.com/" >Sarthak Mangla</Anchor> and <Anchor href="https://github.com/unkn-wn" >Leon Yee</Anchor>!</p>
		
		<p>We're powered by <b>Next.js (and React, Tailwind, etc) and Apache Lucene (for full-text search)</b>. Our data comes directly from the Purdue catalog, which is backed by Ellucian's  very slow and clunky Banner Self Service. If you'd like a taste, you can download course data <Anchor target="_blank" href="/api/data" >here.</Anchor> It's not complicated.</p>
		
		<p>Check us out on <Anchor target="_blank" href="https://github.com/canislupaster/boilercourses" >
			<IconBrandGithubFilled className="self-center" />
			Github
		</Anchor> for more details. Currently, we only support West Lafayette and a small selection of recent semesters. We'd love to hear your <Anchor href="https://forms.gle/fZ637w34XCFLtTR76" target="_blank" >feedback</Anchor>!</p>

		<p>Made by <Anchor href="https://thomasqm.com" >Thomas Marlowe</Anchor>.</p>
	</div>;
}

export const Footer = ({className}: {className?: string}) => {
	const ctx = useContext(AppCtx);
	return (
		<div className={twMerge('grid justify-center py-4 mt-2', className)} >
			<Text v="dim" className='mx-2 text-center' >
				<span className='flex items-center justify-center'>
					<Anchor target="_blank" onClick={()=>ctx.open({type: "other", modal: <InfoModal/>})} className="items-center align-middle" >
						<IconInfoCircleFilled />
						BoilerCourses
					</Anchor>
				</span>
				is an unofficial catalog for Purdue courses <br/> made by Purdue students.
			</Text>
		</div>
	);
};