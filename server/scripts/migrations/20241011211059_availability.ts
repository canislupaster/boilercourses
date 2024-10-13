import type {Knex} from "knex";
import {DBCourse} from "../db";
import {Course} from "../../../shared/types";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("availability_notification", tb=>{
		tb.bigIncrements("id");
		tb.integer("course").references("course.id").notNullable().onDelete("CASCADE");
		tb.integer("user").references("user.id").notNullable().onDelete("CASCADE");
		tb.integer("crn"); //specific section if requested

		tb.integer("threshold").notNullable(); //minimum number of open seats until triggered

		tb.boolean("satisfied").defaultTo(false);
		tb.boolean("sent").defaultTo(false); //email sent
		tb.text("term").notNullable();

		tb.index(["course", "crn", "sent", "term", "threshold"]);
		tb.index(["satisfied", "sent"]);
		tb.unique(["course", "user", "crn"]);
	}).createTable("email_block", tb=>{
		tb.text("email").primary().notNullable();
		tb.binary("key").notNullable();
		tb.boolean("blocked").defaultTo(false).notNullable();
	}).createTable("properties", tb=>{
		tb.text("name").primary();
		tb.text("value").notNullable();
	});

	await knex.transaction(async trx => {
		await Promise.all((await trx<DBCourse>("course").select("id", "data")).map(async v=>{
			const d = JSON.parse(v.data) as Course;
			for (const sec of Object.values(d.sections)) {
				for (const s of sec) {
					delete s["permissionOfInstructor"];
					delete s["permissionOfDept"];
					delete s["waitlist"];
				}
			}

			await trx<DBCourse>("course").update({data: JSON.stringify(d)}).where({id: v.id});
		}));
	});
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema
		.dropTable("availability_notification")
		.dropTable("email_block")
		.dropTable("properties");
}
