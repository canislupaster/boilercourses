import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable("section_enrollment", tb=>{
		tb.bigIncrements("id");
		tb.integer("course").references("course.id").notNullable().onDelete("CASCADE");
		tb.integer("crn").notNullable();
		tb.text("term").notNullable();
		tb.timestamp("time").notNullable();
		tb.integer("enrollment").notNullable();
	});

	await knex.schema.renameTable("scheduleType", "schedule_type");
}


export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTable("section_enrollment");
	await knex.schema.renameTable("schedule_type", "scheduleType");
}

