"use strict";
const DocUtils = require("./doc-utils");
DocUtils.traits = require("./traits");
DocUtils.moduleWrapper = require("./module-wrapper");

const Lexer = require("./lexer");
const {
	defaults,
	str2xml,
	xml2str,
	moduleWrapper,
	utf8ToWord,
	concatArrays,
	unique,
} = DocUtils;
const {
	XTInternalError,
	throwFileTypeNotIdentified,
	throwFileTypeNotHandled,
	throwApiVersionError,
} = require("./errors");

const currentModuleApiVersion = [3, 10, 0];

const Docxtemplater = class Docxtemplater {
	constructor() {
		if (arguments.length > 0) {
			throw new Error(
				"The constructor with parameters has been removed in docxtemplater 3, please check the upgrade guide.",
			);
		}
		this.compiled = {};
		this.modules = [];
		this.setOptions({});
	}

	getModuleApiVersion() {
		return currentModuleApiVersion.join(".");
	}

	verifyApiVersion(neededVersion) {
		neededVersion = neededVersion.split(".").map(function(i) {
			return parseInt(i, 10);
		});
		if (neededVersion.length !== 3) {
			throwApiVersionError("neededVersion is not a valid version", {
				neededVersion,
				explanation: "the neededVersion must be an array of length 3",
			});
		}
		if (neededVersion[0] !== currentModuleApiVersion[0]) {
			throwApiVersionError(
				"The major api version do not match, you probably have to update docxtemplater with npm install --save docxtemplater",
				{
					neededVersion,
					currentModuleApiVersion,
					explanation: `moduleAPIVersionMismatch : needed=${neededVersion.join(
						".",
					)}, current=${currentModuleApiVersion.join(".")}`,
				},
			);
		}
		if (neededVersion[1] > currentModuleApiVersion[1]) {
			throwApiVersionError(
				"The minor api version is not uptodate, you probably have to update docxtemplater with npm install --save docxtemplater",
				{
					neededVersion,
					currentModuleApiVersion,
					explanation: `moduleAPIVersionMismatch : needed=${neededVersion.join(
						".",
					)}, current=${currentModuleApiVersion.join(".")}`,
				},
			);
		}
		return true;
	}

	setModules(obj) {
		this.modules.forEach(module => {
			module.set(obj);
		});
	}

	sendEvent(eventName) {
		this.modules.forEach(module => {
			module.on(eventName);
		});
	}

	attachModule(module, options = {}) {
		const { prefix } = options;
		if (prefix) {
			module.prefix = prefix;
		}
		const wrappedModule = moduleWrapper(module);
		this.modules.push(wrappedModule);
		wrappedModule.on("attached");
		return this;
	}

	setOptions(options) {
		if (options.delimiters) {
			options.delimiters.start = utf8ToWord(options.delimiters.start);
			options.delimiters.end = utf8ToWord(options.delimiters.end);
		}
		this.options = options;
		Object.keys(defaults).forEach(key => {
			const defaultValue = defaults[key];
			this.options[key] =
				this.options[key] != null ? this.options[key] : defaultValue;
			this[key] = this.options[key];
		});
		if (this.zip) {
			this.updateFileTypeConfig();
		}
		return this;
	}

	loadZip(zip) {
		/* if (zip.loadAsync) {
			throw new XTInternalError(
				"Docxtemplater doesn't handle JSZip version >=3, see changelog"
			);
		} */
		this.zip = zip;
		this.updateFileTypeConfig();

		this.modules = concatArrays([
			this.fileTypeConfig.baseModules.map(function(moduleFunction) {
				return moduleFunction();
			}),
			this.modules,
		]);
		return this;
	}

	compileFile(index) {
		const fileName = this.templatedFiles[index];
		if (fileName && this.zip.files[fileName]) {
			return this.createTemplateClass(fileName).then(currentFile => {
				currentFile.parse();
				this.compiled[fileName] = currentFile;
				return this.compileFile(index + 1);
			});
		}
		if (index < this.templatedFiles.length) {
			return this.compileFile(index + 1);
		}
		return Promise.resolve();
	}

	resolveData(data) {
		return Promise.all(
			Object.keys(this.compiled).map(from => {
				const currentFile = this.compiled[from];
				return currentFile.resolveTags(data);
			}),
		).then(resolved => {
			return concatArrays(resolved);
		});
	}

	compile() {
		if (Object.keys(this.compiled).length) {
			return Promise.resolve(this);
		}
		this.options = this.modules.reduce((options, module) => {
			return module.optionsTransformer(options, this);
		}, this.options);
		this.options.xmlFileNames = unique(this.options.xmlFileNames);
		this.options.xmlFileNames = unique(this.options.xmlFileNames);
		this.xmlDocuments = this.options.xmlFileNames.reduce(
			(xmlDocuments, fileName) => {
				return this.zip.files[fileName].async("string").then(content => {
					xmlDocuments[fileName] = str2xml(content);
					return xmlDocuments;
				});
			},
			{}
		);

		this.setModules({
			zip: this.zip,
			xmlDocuments: this.xmlDocuments,
		});
		this.getTemplatedFiles();
		this.setModules({ compiled: this.compiled });
		// Loop inside all templatedFiles (ie xml files with content).
		// Sometimes they don't exist (footer.xml for example)
		return this.compileFile(0).then(() => {
				return this;
		});
	}

	updateFileTypeConfig() {
		let fileType;
		if (this.zip.files.mimetype) {
			fileType = "odt";
		}
		if (
			this.zip.files["word/document.xml"] ||
			this.zip.files["word/document2.xml"]
		) {
			fileType = "docx";
		}
		if (this.zip.files["ppt/presentation.xml"]) {
			fileType = "pptx";
		}

		if (fileType === "odt") {
			throwFileTypeNotHandled(fileType);
		}
		if (!fileType) {
			throwFileTypeNotIdentified();
		}
		this.fileType = fileType;
		this.fileTypeConfig =
			this.options.fileTypeConfig ||
			Docxtemplater.FileTypeConfig[this.fileType];
		return this;
	}

	render() {
		return this.compile().then(() => {
			this.setModules({
				data: this.data,
				Lexer,
			});
			this.mapper = this.modules.reduce(function(value, module) {
				return module.getRenderedMap(value);
			}, {});

			this.fileTypeConfig.tagsXmlLexedArray = unique(
				this.fileTypeConfig.tagsXmlLexedArray,
			);
			this.fileTypeConfig.tagsXmlTextArray = unique(
				this.fileTypeConfig.tagsXmlTextArray,
			);

			Object.keys(this.mapper).forEach(to => {
				const { from, data } = this.mapper[to];
				const currentFile = this.compiled[from];
				currentFile.setTags(data);
				currentFile.render(to);
				this.zip.file(to, currentFile.content, { createFolders: true });
			});
			this.sendEvent("syncing-zip");
			this.syncZip();
			return this;
		});
	}

	syncZip() {
		Object.keys(this.xmlDocuments).forEach(fileName => {
			this.zip.remove(fileName);
			const content = xml2str(this.xmlDocuments[fileName]);
			return this.zip.file(fileName, content, { createFolders: true });
		});
	}

	setData(data) {
		this.data = data;
		return this;
	}

	getZip() {
		return this.zip;
	}

	createTemplateClass(path) {
		return this.zip.files[path].async("text").then(usedData => {
			return this.createTemplateClassFromContent(usedData, path);
		});
	}

	createTemplateClassFromContent(content, filePath) {
		const xmltOptions = {
			filePath,
		};
		Object.keys(defaults).forEach(key => {
			xmltOptions[key] = this[key];
		});
		xmltOptions.fileTypeConfig = this.fileTypeConfig;
		xmltOptions.modules = this.modules;
		return new Docxtemplater.XmlTemplater(content, xmltOptions);
	}

	getFullText(path) {
		return this.createTemplateClass(
			path || this.fileTypeConfig.textPath(this.zip),
		).then(res => res.getFullText());
	}

	getTemplatedFiles() {
		this.templatedFiles = this.fileTypeConfig.getTemplatedFiles(this.zip);
		return this.templatedFiles;
	}
};

Docxtemplater.DocUtils = DocUtils;
Docxtemplater.Errors = require("./errors");
Docxtemplater.XmlTemplater = require("./xml-templater");
Docxtemplater.FileTypeConfig = require("./file-type-config");
Docxtemplater.XmlMatcher = require("./xml-matcher");
module.exports = Docxtemplater;
