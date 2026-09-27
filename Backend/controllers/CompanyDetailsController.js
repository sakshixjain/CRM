const Company = require("../models/CompanyDetails");
const { Op } = require("sequelize");

// CREATE
exports.createCompany = async (req, res) => {
  try {
    const {
      company_name,
      email,
      contact_no,
      website,
      address,
      city,
      state,
      country,
      pincode,
      logo_url,
      db_name,
      is_active,
    } = req.body;

    if (!company_name || !email || !db_name) {
      return res.status(400).json({
        success: false,
        message: "company_name, email, and db_name are required",
      });
    }

    const trimmedCompanyName = String(company_name).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedDbName = String(db_name).trim();

    const existingCompany = await Company.findOne({
      where: {
        db_name: trimmedDbName,
      },
    });

    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message: "db_name already exists",
      });
    }

    const company = await Company.create({
      company_name: trimmedCompanyName,
      email: trimmedEmail,
      contact_no: contact_no ? String(contact_no).trim() : null,
      website: website ? String(website).trim() : null,
      address: address ? String(address).trim() : null,
      city: city ? String(city).trim() : null,
      state: state ? String(state).trim() : null,
      country: country ? String(country).trim() : "India",
      pincode: pincode ? String(pincode).trim() : null,
      logo_url: logo_url ? String(logo_url).trim() : null,
      db_name: trimmedDbName,
      is_active: typeof is_active === "boolean" ? is_active : true,
    });

    return res.status(201).json({
      success: true,
      message: "Company created successfully",
      data: company,
    });
  } catch (error) {
    console.error("createCompany error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create company",
      error: error.message,
    });
  }
};

// GET ALL
exports.getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.findAll({
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Companies fetched successfully",
      data: companies,
    });
  } catch (error) {
    console.error("getAllCompanies error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
      error: error.message,
    });
  }
};

// GET SINGLE
exports.getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findByPk(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Company fetched successfully",
      data: company,
    });
  } catch (error) {
    console.error("getCompanyById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch company",
      error: error.message,
    });
  }
};

// UPDATE
exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      company_name,
      email,
      contact_no,
      website,
      address,
      city,
      state,
      country,
      pincode,
      logo_url,
      db_name,
      is_active,
    } = req.body;

    const company = await Company.findByPk(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    if (db_name && String(db_name).trim() !== company.db_name) {
      const existingDbName = await Company.findOne({
        where: {
          db_name: String(db_name).trim(),
          id: { [Op.ne]: id },
        },
      });

      if (existingDbName) {
        return res.status(409).json({
          success: false,
          message: "db_name already exists",
        });
      }
    }

    await company.update({
      company_name:
        company_name !== undefined
          ? String(company_name).trim()
          : company.company_name,

      email:
        email !== undefined ? String(email).trim().toLowerCase() : company.email,

      contact_no:
        contact_no !== undefined
          ? contact_no
            ? String(contact_no).trim()
            : null
          : company.contact_no,

      website:
        website !== undefined
          ? website
            ? String(website).trim()
            : null
          : company.website,

      address:
        address !== undefined
          ? address
            ? String(address).trim()
            : null
          : company.address,

      city:
        city !== undefined
          ? city
            ? String(city).trim()
            : null
          : company.city,

      state:
        state !== undefined
          ? state
            ? String(state).trim()
            : null
          : company.state,

      country:
        country !== undefined
          ? country
            ? String(country).trim()
            : null
          : company.country,

      pincode:
        pincode !== undefined
          ? pincode
            ? String(pincode).trim()
            : null
          : company.pincode,

      logo_url:
        logo_url !== undefined
          ? logo_url
            ? String(logo_url).trim()
            : null
          : company.logo_url,

      db_name:
        db_name !== undefined ? String(db_name).trim() : company.db_name,

      is_active:
        is_active !== undefined ? Boolean(is_active) : company.is_active,
    });

    return res.status(200).json({
      success: true,
      message: "Company updated successfully",
      data: company,
    });
  } catch (error) {
    console.error("updateCompany error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update company",
      error: error.message,
    });
  }
};

// DELETE
exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findByPk(id);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    await company.destroy();

    return res.status(200).json({
      success: true,
      message: "Company deleted successfully",
    });
  } catch (error) {
    console.error("deleteCompany error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete company",
      error: error.message,
    });
  }
};