const { createDoc, shouldBeSame, expect } = require("./utils");

describe("Docx docprops", function() {
	it("should change values with template data", function(done) {
		const tags = {
			first_name: "Hipp",
			last_name: "Edgar",
			phone: "0652455478",
			description: "New Website",
		};
		createDoc("tag-docprops.docx").then(doc => {
			doc.setData(tags);
			doc.render()
				.then(() => doc.getFullText())
				.then(fullText => {
					expect(fullText).to.be.equal("Edgar Hipp");
				})
				.then(() => doc.getFullText("word/header1.xml"))
				.then(fulltext => {
					expect(fulltext).to.be.equal(
						"Edgar Hipp0652455478New Website"
					);
				})
				.then(() => doc.getFullText("word/footer1.xml"))
				.then(fulltext => {
					expect(fulltext).to.be.equal(
						"EdgarHipp0652455478"
					);
				})
				.then(() => {
					shouldBeSame({ doc, expectedName: "expected-tag-docprops.docx" });
					done();
				});
		});
	});
});
