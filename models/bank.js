"use strict";

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    async = require('async'),
    _ = require('lodash'),
    ObjectId = mongoose.Schema.Types.ObjectId;

var Dict = INCLUDE('dict');
var round = MODULE('utils').round;

/**
 * Bank Schema
 */
var bankSchema = new Schema({
    ref: { type: String, unique: true },
    account_type: String,
    name_bank: String,
    code_bank: Number,
    number_bank: Number,
    code_counter: String,
    account_number: String,
    iban: {
        bank: { type: String, uppercase: true, trim: true },
        id: { type: String, set: MODULE('utils').setNoSpace, uppercase: true, trim: true }, //FR76........
        bic: { type: String, set: MODULE('utils').setNoSpace, uppercase: true, trim: true } //BIC / SWIFT TODO old swift
    },
    currency: String,
    status: String,
    reconciled: Boolean,
    min_balance_allowed: Number,
    min_balance_required: Number,
    web: String,
    comment: String,
    entity: [{ type: String, trim: true }],
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zip: { type: String, default: '' },
        country: { type: String, ref: 'countries', default: 'FR' }
    },
    createdBy: { type: ObjectId, ref: 'Users' },
    editedBy: { type: ObjectId, ref: 'Users' },
    journalId: { type: String, unique: true }, // BQ1
    compta_bank: { type: String, unique: true }, // 512xxxx
    invoice: String // Text on invoice for payment
}, {
    toObject: { virtuals: true },
    toJSON: { virtuals: true }
});

var statusList = {};

Dict.dict({ dictName: "fk_account_status", object: true }, function(err, docs) {
    statusList = docs;
});

bankSchema.virtual('acc_status').get(function() {
    var acc_status = {};

    var status = this.status;

    if (status && statusList.values[status] && statusList.values[status].label) {
        acc_status.id = status;
        acc_status.name = statusList.values[status].label;
        acc_status.css = statusList.values[status].cssClass;
    } else { // By default
        acc_status.id = status;
        acc_status.name = status;
        acc_status.css = "";
    }
    return acc_status;
});

bankSchema.virtual('name').get(function() {
    return this.journalId + " (" + this.name_bank + " " + this.account_number + ")";
});

var typeList = {};

Dict.dict({ dictName: "fk_account_type", object: true }, function(err, docs) {

    typeList = docs;
});

bankSchema.virtual('acc_type').get(function() {

    var acc_type = {};
    var account_type = this.account_type;

    if (account_type && typeList.values[account_type] && typeList.values[account_type].label) {
        acc_type.id = account_type;
        acc_type.name = typeList.values[account_type].label;
        acc_type.css = typeList.values[account_type].cssClass;
    } else { // By default
        acc_type.id = account_type;
        acc_type.name = account_type;
        acc_type.css = "";
    }

    return acc_type;
});

var countryList = {};

Dict.dict({ dictName: "fk_country", object: true }, function(err, docs) {

    countryList = docs;
});

bankSchema.virtual('acc_country').get(function() {

    var acc_country = "";
    var account_country = this.country;

    if (account_country)
        acc_country = countryList.values[account_country].label;

    return acc_country;
});

/*bankSchema.virtual('balance').get(function () {
 
 var balance;
 var id = this._id;
 
 if (transactionList) {
 for (var i = 0; i < transactionList.length; i++) {
 if (id.equals(transactionList[i]._id)) {
 balance = transactionList[i].sumC - transactionList[i].sumD;
 return balance;
 }
 }
 }
 
 return 0;
 });*/

/*
 * bills_client or bills_supplier : [{
 *  _id,
 *  ref,
 *  payment // amount
 * }]
 */

/*bankSchema.methods.addPayment = function(options, user, callback) {
    var self = this;
    //var SocieteModel = MODEL('Customers').Schema;
    var BillModel = MODEL('invoice').Schema;
    //var BillSupplierModel = MODEL('billSupplier').Schema;

    //console.log(options);
    //return;

    var SeqModel = MODEL('Sequence').Schema; // Pour le numero de piece automatique

    //return console.log(this.body);
    var Book = INCLUDE('accounting').Book;
    var myBook = new Book();

    // for VTA
    var myBookOD = new Book();

    if (!self.journalId)
        return callback('Journal de banque absent. Voir la configuration de la banque');

    myBook.setName(self.journalId);
    //myBook.setEntity(body.bank.entity);

    myBookOD.setName('OD');
    //myBookOD.setEntity(body.bank.entity);

    // Ecriture du reglement
    var entry = myBook.entry(options.label, options.datec, user);
    var entryOD = myBookOD.entry(options.label, options.datec, user);

    SeqModel.incCpt("PAY", function(seq) {
        //console.log(seq);
        entry.setSeq(seq);
        entryOD.setSeq(seq);

        var bills = [];
        if (options.bills)
            for (var i = 0, len = options.bills.length; i < len; i++)
                if (options.bills[i].payment != null)
                    bills.push({
                        invoice: options.bills[i]._id,
                        amount: options.bills[i].payment
                    });

                //var billsSupplier = [];
        if (options.bills_supplier)
            for (var i = 0, len = options.bills_supplier.length; i < len; i++)
                if (options.bills_supplier[i].payment != null)
                    bills.push({
                        invoice: options.bills_supplier[i]._id,
                        amount: options.bills_supplier[i].payment
                    });


        if (options.mode === "Receipt")
            entry.debit(self.compta_bank, options.amount, {
                type: options.mode_reglement_code,
                pieceAccounting: options.pieceAccounting,
                bills: bills // Liste des factures
                    //billsSupplier: billsSupplier
            });
        else
            entry.credit(self.compta_bank, options.amount, {
                type: options.mode_reglement_code,
                pieceAccounting: options.pieceAccounting,
                bills: bills // Liste des factures
                    //billsSupplier: billsSupplier
            });
        // Get entity for TVA_MODE

        async.waterfall([
            // get entity
            function(callback) {
                //load supplier
                const CustomersModel = MODEL('Customers').Schema;

                CustomersModel.findById(bill.supplier._id || bill.supplier, callback);
            },

            // apply entry
            function(supplier, callback) {
                if (!supplier)
                    return callback("No supplier found");

                const TaxModel = MODEL('taxes').Schema;
                // client
                for (var i = 0, len = options.bills.length; i < len; i++) {
                    var bill = options.bills[i];

                    return console.log(bill.supplier);
                    if (bill.payment != null) {
                        if (bill.payment > 0)
                            entry.credit(supplier.salesPurchases.customerAccount, Math.abs(bill.payment), {
                                invoice: bill._id,
                                societe: supplier._id
                            });
                        else
                            entry.debit(supplier.salesPurchases.customerAccount, Math.abs(bill.payment), {
                                invoice: bill._id,
                                societe: supplier._id
                            });

                        //Migrate TVA to final account
                        return console.log(bill.total_taxes);


                        if (entity.tva_mode === 'payment') // TVA sur encaissement
                            if (round(bill.payment + bill.total_paid, 2) >= round(bill.total_ttc, 2)) // Full paid
                                for (var j = 0, len2 = bill.total_tva.length; j < len2; j++) {
                                // No TVA
                                if (bill.total_tva[j].total == 0)
                                    continue;

                                // TVA on payment
                                if (bill.total_tva[j].total > 0) {
                                    entryOD.debit(tva.tva_code_colle[bill.total_tva[j].tva_tx], Math.abs(bill.total_tva[j].total), {
                                        billId: bill._id.toString(),
                                        billRef: bill.ref,
                                        tva_tx: bill.total_tva[j].tva_tx
                                    });
                                    entryOD.credit(tva.tva_code_colle_paid[bill.total_tva[j].tva_tx], Math.abs(bill.total_tva[j].total), {
                                        billId: bill._id.toString(),
                                        billRef: bill.ref,
                                        tva_tx: bill.total_tva[j].tva_tx
                                    });
                                } else {
                                    // Si avoir
                                    entryOD.credit(tva.tva_code_colle[bill.total_tva[j].tva_tx], Math.abs(bill.total_tva[j].total), {
                                        billId: bill._id.toString(),
                                        billRef: bill.ref,
                                        tva_tx: bill.total_tva[j].tva_tx
                                    });
                                    entryOD.debit(tva.tva_code_colle_paid[bill.total_tva[j].tva_tx], Math.abs(bill.total_tva[j].total), {
                                        billId: bill._id.toString(),
                                        billRef: bill.ref,
                                        tva_tx: bill.total_tva[j].tva_tx
                                    });
                                }
                            }
                    }
                }

                for (var i = 0, len = options.bills_supplier.length; i < len; i++) {
                    var bill = options.bills_supplier[i];

                    if (bill.payment != null) {
                        if (bill.payment > 0)
                            entry.debit(bill.supplier.salesPurchases.supplierAccount, Math.abs(bill.payment), {
                                invoice: bill._id,
                                societe: bill.supplier._id
                            });
                        else
                            entry.credit(bill.supplier.salesPurchases.supplierAccount, Math.abs(bill.payment), {
                                invocie: bill._id,
                                societe: bill.supplier._id
                            });

                        //Migrate TVA to final account
                        if (entity.tva_mode === 'payment') // TVA sur encaissement
                            if (round(bill.payment + bill.total_paid, 2) >= round(bill.total_ttc, 2)) // Full paid
                                for (var j = 0, len2 = bill.total_tva.length; j < len2; j++) {

                                if (bill.total_tva[j].total == 0)
                                    continue;

                                // TVA on payment
                                if (bill.total_tva[j].total > 0) {
                                    entryOD.credit(tva.tva_code_deduc[bill.total_tva[j].tva_tx], Math.abs(bill.total_tva[j].total), {
                                        billSupplierId: bill._id.toString(),
                                        billSupplierRef: bill.ref,
                                        tva_tx: bill.total_tva[j].tva_tx
                                    });
                                    entryOD.debit(tva.tva_code_deduc_paid[bill.total_tva[j].tva_tx], Math.abs(bill.total_tva[j].total), {
                                        billSupplierId: bill._id.toString(),
                                        billSupplierRef: bill.ref,
                                        tva_tx: bill.total_tva[j].tva_tx
                                    });
                                } else {
                                    // Si avoir
                                    entryOD.debit(tva.tva_code_deduc[bill.total_tva[j].tva_tx], Math.abs(bill.total_tva[j].total), {
                                        billSupplierId: bill._id.toString(),
                                        billSupplierRef: bill.ref,
                                        tva_tx: bill.total_tva[j].tva_tx
                                    });
                                    entryOD.credit(tva.tva_code_deduc_paid[bill.total_tva[j].tva_tx], Math.abs(bill.total_tva[j].total), {
                                        billSupplierId: bill._id.toString(),
                                        billSupplierRef: bill.ref,
                                        tva_tx: bill.total_tva[j].tva_tx
                                    });
                                }
                            }
                    }
                }

                //console.log(entry);
                callback(null);

            },
            // save transaction
            function(callback) {
                var journal_id = [];

                entry.commit().then(function(journal) {
                    //console.log(journal);
                    journal_id.push(journal);

                    // ADD TVA lines
                    if (entryOD.transactions.length)
                        return entryOD.commit().then(function(journal) {
                            journal_id.push(journal);
                            return callback(null, journal_id);
                        }, function(err) {
                            console.log(err);
                            return callback(null, journal_id);
                        });

                    return callback(null, journal_id);
                }, function(err) {
                    callback(err.message);
                });
            },
            // update bills
            function(journal, callback) {

                var journalId = _.map(journal, function(item) {
                    return item._id;
                });

                //change status bills PAID
                for (var i = 0, len = options.bills.length; i < len; i++) {
                    var bill = options.bills[i];
                    if (bill.payment != null) {
                        //console.log(bill);
                        var status = "STARTED";
                        if (round(bill.payment + bill.total_paid, 2) >= round(bill.total_ttc, 2))
                            status = "PAID";

                        if (round(bill.payment + bill.total_paid, 2) == 0)
                            status = 'NOT_PAID';

                        BillModel.update({ _id: bill._id }, { $set: { Status: status, updatedAt: new Date() }, $inc: { total_paid: bill.payment }, $addToSet: { journalId: { $each: journalId } } }, function(err, doc) {
                            if (err)
                                console.log(err);
                            //console.log(doc);
                        });
                    }
                }

                for (var i = 0, len = options.bills_supplier.length; i < len; i++) {
                    var bill = options.bills_supplier[i];
                    if (bill.payment != null) {
                        //console.log(bill);
                        var status = "STARTED";
                        if (round(bill.payment + bill.total_paid, 2) >= round(bill.total_ttc, 2))
                            status = "PAID";
                        BillSupplierModel.update({ _id: bill._id }, { $set: { Status: status, updatedAt: new Date() }, $inc: { total_paid: bill.payment }, $addToSet: { journalId: { $each: journalId } } }, function(err, doc) {
                            if (err)
                                console.log(err);
                            //console.log(doc);
                        });
                    }
                }
                callback(null, journal);
            }
        ], callback);
    });
};*/

exports.Schema = mongoose.model('bank', bankSchema, 'Bank');
exports.name = 'bank';