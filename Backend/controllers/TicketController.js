const { Op } = require("sequelize");
const Ticket = require("../models/Ticket");
const Lead = require("../models/Leads");
const Agent = require("../models/UserAgent");
const Admin = require("../models/Admin");

function generateTicketNumber() {
  const timestamp = Date.now().toString().slice(-5);
  const random = Math.floor(100 + Math.random() * 900);
  return `TCK-${timestamp}${random}`;
}

exports.getTicketStats = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const isAgent =
      req.user?.type === "agent" ||
      (req.user?.role_id !== undefined && Number(req.user.role_id) !== 1);

    const baseWhere = { company_id: companyId };
    if (isAgent) {
      baseWhere.assigned_to = req.user.id;
    }

    const [total, open, inProgress, pending, resolved, closed, urgent, high] =
      await Promise.all([
        Ticket.count({ where: baseWhere }),
        Ticket.count({ where: { ...baseWhere, status: "Open" } }),
        Ticket.count({ where: { ...baseWhere, status: "In Progress" } }),
        Ticket.count({ where: { ...baseWhere, status: "Pending" } }),
        Ticket.count({ where: { ...baseWhere, status: "Resolved" } }),
        Ticket.count({ where: { ...baseWhere, status: "Closed" } }),
        Ticket.count({ where: { ...baseWhere, priority: "Urgent" } }),
        Ticket.count({ where: { ...baseWhere, priority: "High" } }),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        open,
        inProgress,
        pending,
        resolved,
        closed,
        urgent,
        high,
      },
    });
  } catch (error) {
    console.error("getTicketStats error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching ticket statistics",
    });
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      page = 1,
      limit = 10,
      search,
      status,
      priority,
      category,
      assigned_to,
      lead_id,
      fromDate,
      toDate,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause = { company_id: companyId };

    const isAgent =
      req.user?.type === "agent" ||
      (req.user?.role_id !== undefined && Number(req.user.role_id) !== 1);

    if (isAgent) {
      whereClause.assigned_to = req.user.id;
    } else {
      if (assigned_to === "unassigned") {
        whereClause[Op.or] = [{ assigned_to: null }, { assigned_to: 0 }];
      } else if (assigned_to) {
        whereClause.assigned_to = Number(assigned_to);
      }
    }

    if (status) {
      whereClause.status = status;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (category) {
      whereClause.category = category;
    }

    if (lead_id) {
      whereClause.lead_id = Number(lead_id);
    }

    if (fromDate || toDate) {
      const start = fromDate ? new Date(`${fromDate}T00:00:00.000`) : null;
      const end = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
      whereClause.createdAt = {};
      if (start) whereClause.createdAt[Op.gte] = start;
      if (end) whereClause.createdAt[Op.lte] = end;
    }

    if (search && String(search).trim()) {
      const s = `%${String(search).trim()}%`;
      whereClause[Op.or] = [
        { ticket_number: { [Op.like]: s } },
        { title: { [Op.like]: s } },
        { description: { [Op.like]: s } },
        { customer_name: { [Op.like]: s } },
        { customer_phone: { [Op.like]: s } },
        { customer_email: { [Op.like]: s } },
        { category: { [Op.like]: s } },
        { "$lead.name$": { [Op.like]: s } },
        { "$assignedAgent.name$": { [Op.like]: s } },
      ];
    }

    const { count, rows } = await Ticket.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Lead,
          as: "lead",
          attributes: ["id", "name", "contact_no", "email", "case_type", "city"],
        },
        {
          model: Agent,
          as: "assignedAgent",
          attributes: ["id", "name", "email", "contact_no"],
        },
        {
          model: Admin,
          as: "creator",
          attributes: ["id", "name", "email"],
        },
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: Number(limit),
      offset,
      distinct: true,
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)) || 1,
      },
    });
  } catch (error) {
    console.error("getAllTickets error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error retrieving tickets",
    });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const ticket = await Ticket.findOne({
      where: { id, company_id: companyId },
      include: [
        {
          model: Lead,
          as: "lead",
          attributes: ["id", "name", "contact_no", "email", "case_type", "city", "address"],
        },
        {
          model: Agent,
          as: "assignedAgent",
          attributes: ["id", "name", "email", "contact_no"],
        },
        {
          model: Admin,
          as: "creator",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("getTicketById error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching ticket",
    });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      title,
      description,
      category,
      priority,
      status,
      lead_id,
      customer_name,
      customer_email,
      customer_phone,
      assigned_to,
      due_date,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: "Ticket title is required",
      });
    }

    let finalCustomerName = customer_name ? String(customer_name).trim() : null;
    let finalCustomerEmail = customer_email ? String(customer_email).trim() : null;
    let finalCustomerPhone = customer_phone ? String(customer_phone).trim() : null;

    if (lead_id && (!finalCustomerName || !finalCustomerPhone)) {
      const lead = await Lead.findOne({
        where: { id: lead_id, company_id: companyId },
      });
      if (lead) {
        finalCustomerName = finalCustomerName || lead.name;
        finalCustomerPhone = finalCustomerPhone || lead.contact_no;
        finalCustomerEmail = finalCustomerEmail || lead.email;
      }
    }

    const ticketNumber = generateTicketNumber();

    const ticket = await Ticket.create({
      company_id: companyId,
      ticket_number: ticketNumber,
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      category: category ? String(category).trim() : "General",
      priority: priority || "Medium",
      status: status || "Open",
      lead_id: lead_id ? Number(lead_id) : null,
      customer_name: finalCustomerName,
      customer_email: finalCustomerEmail,
      customer_phone: finalCustomerPhone,
      assigned_to: assigned_to ? Number(assigned_to) : null,
      created_by: userId || null,
      due_date: due_date || null,
      resolved_at: status === "Resolved" || status === "Closed" ? new Date() : null,
    });

    const fullTicket = await Ticket.findByPk(ticket.id, {
      include: [
        { model: Lead, as: "lead", attributes: ["id", "name", "contact_no", "email"] },
        { model: Agent, as: "assignedAgent", attributes: ["id", "name", "email"] },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: fullTicket,
    });
  } catch (error) {
    console.error("createTicket error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error creating ticket",
    });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const ticket = await Ticket.findOne({
      where: { id, company_id: companyId },
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const {
      title,
      description,
      category,
      priority,
      status,
      lead_id,
      customer_name,
      customer_email,
      customer_phone,
      assigned_to,
      due_date,
      resolution_notes,
    } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (category !== undefined) updates.category = String(category).trim();
    if (priority !== undefined) updates.priority = priority;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to ? Number(assigned_to) : null;
    if (lead_id !== undefined) updates.lead_id = lead_id ? Number(lead_id) : null;
    if (customer_name !== undefined) updates.customer_name = customer_name ? String(customer_name).trim() : null;
    if (customer_email !== undefined) updates.customer_email = customer_email ? String(customer_email).trim() : null;
    if (customer_phone !== undefined) updates.customer_phone = customer_phone ? String(customer_phone).trim() : null;
    if (due_date !== undefined) updates.due_date = due_date || null;
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;

    if (status !== undefined) {
      updates.status = status;
      if (status === "Resolved" || status === "Closed") {
        if (!ticket.resolved_at) updates.resolved_at = new Date();
      } else {
        updates.resolved_at = null;
      }
    }

    await ticket.update(updates);

    const updated = await Ticket.findByPk(ticket.id, {
      include: [
        { model: Lead, as: "lead", attributes: ["id", "name", "contact_no", "email"] },
        { model: Agent, as: "assignedAgent", attributes: ["id", "name", "email"] },
        { model: Admin, as: "creator", attributes: ["id", "name", "email"] },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("updateTicket error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error updating ticket",
    });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const deleted = await Ticket.destroy({
      where: { id, company_id: companyId },
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    console.error("deleteTicket error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error deleting ticket",
    });
  }
};
