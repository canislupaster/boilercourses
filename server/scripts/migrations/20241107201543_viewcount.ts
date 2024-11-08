import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
	if ((await knex("email_block").count({count: "*"}).first())?.count)
		throw new Error("existing email blocks");

	const hasViews = await knex.schema.hasColumn("course", "views");
	return knex.schema.alterTable("course", tb=>{
			if (!hasViews) tb.integer("views").notNullable().defaultTo(0).index();
		})
		.dropTable("email_block")
		.createTable("email_block", tb=>{
			tb.text("email").primary().notNullable();
			tb.text("key").notNullable();
			tb.boolean("blocked").defaultTo(false).notNullable();
			tb.boolean("verified").defaultTo(false).notNullable();
			tb.integer("verification_count").defaultTo(0).notNullable();
		});
}

export async function down(knex: Knex): Promise<void> {
	if ((await knex("email_block").count({count: "*"}).first())?.count)
		throw new Error("existing email blocks");

	return knex.schema.dropTable("email_block")
		.createTable("email_block", tb => {
			tb.text("email").primary().notNullable();
			tb.binary("key").notNullable();
			tb.boolean("blocked").defaultTo(false).notNullable();
		});
}
