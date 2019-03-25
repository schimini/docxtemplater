const Lexer = require("../lexer.js");
const { expect, makeDocx, cleanRecursive } = require("./utils");
const fixtures = require("./fixtures");
const docxconfig = require("../file-type-config").docx;
const inspectModule = require("../inspect-module.js");
const tagsDocxConfig = {
	text: docxconfig.tagsXmlTextArray,
	other: docxconfig.tagsXmlLexedArray,
};

describe("Algorithm", function() {
	Object.keys(fixtures).forEach(function(key) {
		const fixture = fixtures[key];
		(fixture.only ? it.only : it)(fixture.it, function() {
			makeDocx(key, fixture.content).then(doc => {
				doc.setOptions(fixture.options);
				const iModule = inspectModule();
				doc.attachModule(iModule);
				doc.setData(fixture.scope);
				return doc.render().then(() => {
					cleanRecursive(iModule.inspect.lexed);
					cleanRecursive(iModule.inspect.parsed);
					cleanRecursive(iModule.inspect.postparsed);
					if (iModule.inspect.content && fixture.result !== null) {
						expect(iModule.inspect.content).to.be.deep.equal(
							fixture.result,
							"Content incorrect",
						);
					}
					if (fixture.lexed !== null) {
						expect(iModule.inspect.lexed).to.be.deep.equal(
							fixture.lexed,
							"Lexed incorrect",
						);
					}
					if (fixture.parsed !== null) {
						expect(iModule.inspect.parsed).to.be.deep.equal(
							fixture.parsed,
							"Parsed incorrect",
						);
					}
					if (fixture.postparsed !== null) {
						expect(iModule.inspect.postparsed).to.be.deep.equal(
							fixture.postparsed,
							"Postparsed incorrect",
						);
					}
				});
			});
		});
	});

	Object.keys(fixtures).forEach(function(key) {
		const fixture = fixtures[key];
		(fixture.only ? it.only : it)(`Async ${fixture.it}`, function() {
			makeDocx(key, fixture.content).then(doc => {
				doc.setOptions(fixture.options);
				const iModule = inspectModule();
				doc.attachModule(iModule);
				doc.compile().then(() => {
					return doc.resolveData(fixture.scope).then(() => doc.render()).then(function() {
						cleanRecursive(iModule.inspect.lexed);
						cleanRecursive(iModule.inspect.parsed);
						cleanRecursive(iModule.inspect.postparsed);
						if (iModule.inspect.content) {
							expect(iModule.inspect.content).to.be.deep.equal(
								fixture.result,
								"Content incorrect",
							);
						}
						if (fixture.resolved) {
							expect(iModule.inspect.resolved).to.be.deep.equal(
								fixture.resolved,
								"Resolved incorrect",
							);
						}
						if (fixture.lexed !== null) {
							expect(iModule.inspect.lexed).to.be.deep.equal(
								fixture.lexed,
								"Lexed incorrect",
							);
						}
						if (fixture.parsed !== null) {
							expect(iModule.inspect.parsed).to.be.deep.equal(
								fixture.parsed,
								"Parsed incorrect",
							);
						}
						if (fixture.postparsed !== null) {
							expect(iModule.inspect.postparsed).to.be.deep.equal(
								fixture.postparsed,
								"Postparsed incorrect",
							);
						}
					});
				});
			});
		});
	});

	it("should xmlparse strange tags", function() {
		const xmllexed = Lexer.xmlparse(
			fixtures.strangetags.content,
			tagsDocxConfig,
		);
		cleanRecursive(xmllexed);
		expect(xmllexed).to.be.deep.equal(fixtures.strangetags.xmllexed);
	});
});
