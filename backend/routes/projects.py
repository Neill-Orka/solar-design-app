# routes/projects.py
from datetime import datetime

from flask import Blueprint, request, jsonify
from models import (
    SA_TZ,
    Document,
    db,
    Projects,
    LoadProfiles,
    Product,
    ComponentRule,
    User,
    UserRole,
)
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from .tariffs import serialize_tariff

projects_bp = Blueprint("projects", __name__)


def optional_user_id():
    verify_jwt_in_request(optional=True)
    return get_jwt_identity()


def mark_project_activity(project_id: int, user_id: int | None):
    """Touch project last-updated fields (only for dashboard changes)."""
    proj = Projects.query.get(project_id)
    if not proj:
        return
    proj.updated_at = datetime.now(SA_TZ)
    if user_id:
        proj.updated_by_id = user_id
    db.session.add(proj)


@projects_bp.route("/projects", methods=["GET"])
def get_projects():
    try:
        # Check for client_id filter parameter
        client_id = request.args.get("client_id", type=int)

        # Apply filter if client_id is provided
        if client_id:
            projects = Projects.query.filter_by(client_id=client_id).filter(
                (Projects.is_deleted.is_(False)) | (Projects.is_deleted.is_(None))
            )
        else:
            projects = Projects.query.filter(
                (Projects.is_deleted.is_(False)) | (Projects.is_deleted.is_(None))
            ).all()

        return jsonify(
            [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "client_name": p.client.client_name,
                    "client_email": p.client.email,
                    "client_phone": p.client.phone,
                    "location": p.location,
                    "latitude": p.latitude,
                    "longitude": p.longitude,
                    "system_type": p.system_type,
                    "panel_kw": p.panel_kw,
                    "panel_id": p.panel_id,
                    "inverter_kva": p.inverter_kva,
                    "inverter_ids": (
                        p.inverter_ids if p.inverter_ids is not None else []
                    ),
                    "battery_ids": p.battery_ids if p.battery_ids is not None else [],
                    "battery_kwh": p.battery_kwh,
                    "project_value_excl_vat": p.project_value_excl_vat,
                    "site_contact_person": p.site_contact_person,
                    "site_phone": p.site_phone,
                    "design_type": p.design_type,
                    "project_type": p.project_type,
                    "tariff_id": p.tariff_id,
                    "custom_flat_rate": p.custom_flat_rate,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                    "created_by": p.created_by.full_name if p.created_by else "",
                    "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                    "updated_by": p.updated_by.full_name if p.updated_by else None,
                    "tariff_details": serialize_tariff(p.tariff) if p.tariff else None,
                }
                for p in projects
            ]
        )
    except Exception as e:
        import traceback

        print(f"Error in get_projects: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/projects/<int:project_id>", methods=["GET"])
def get_project_by_id(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project or project.is_deleted:
            return jsonify({"error": "Project not found"}), 404

        # Update debug logging to remove panel_id
        print(
            f"Project data: ID={project.id}, inverter_ids={project.inverter_ids}, battery_ids={project.battery_ids}"
        )

        inverter_ids = project.inverter_ids if project.inverter_ids is not None else []
        battery_ids = project.battery_ids if project.battery_ids is not None else []

        from_standard_template = getattr(project, "from_standard_template", False)
        template_id = getattr(project, "template_id", None)
        template_name = getattr(project, "template_name", None)
        bom_modified = getattr(project, "bom_modified", False)

        return jsonify(
            {
                "id": project.id,
                "name": project.name,
                "client_name": project.client.client_name,
                "client_email": project.client.email,
                "client_phone": project.client.phone,
                "company": project.client.company,
                "vat_number": project.client.vat_number,
                "location": project.location,
                "latitude": project.latitude,
                "longitude": project.longitude,
                "system_type": project.system_type,
                "panel_kw": project.panel_kw,
                "panel_id": project.panel_id,
                "num_panels": project.num_panels,
                "inverter_kva": project.inverter_kva,
                "inverter_ids": inverter_ids,
                "battery_ids": battery_ids,
                "battery_kwh": project.battery_kwh,
                "project_value_excl_vat": project.project_value_excl_vat,
                "site_contact_person": project.site_contact_person,
                "site_phone": project.site_phone,
                "design_type": project.design_type,
                "project_type": project.project_type,
                "tariff_id": project.tariff_id,
                "custom_flat_rate": project.custom_flat_rate,
                "tariff_details": (
                    serialize_tariff(project.tariff) if project.tariff else None
                ),
                "surface_tilt": project.surface_tilt,
                "surface_azimuth": project.surface_azimuth,
                "use_pvgis": project.use_pvgis,
                "updated_at": (
                    project.updated_at.isoformat() if project.updated_at else None
                ),
                "updated_by": (
                    project.updated_by.full_name if project.updated_by else None
                ),
                "generation_profile_name": project.generation_profile_name,
                # Make sure these fields are included
                "from_standard_template": from_standard_template,
                "template_id": template_id,
                "template_name": template_name,
                "bom_modified": bom_modified,
                "generator_config": project.generator_config,
            }
        )
    except Exception as e:
        # Add better error logging
        import traceback

        print(f"Error in get_project_by_id: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/projects", methods=["POST"])
@jwt_required()
def add_project():
    try:
        data = request.json
        user_id = get_jwt_identity()
        if data is None:
            return jsonify({"error": "No JSON data provided"}), 400
        new_project = Projects(
            client_id=data["client_id"],
            name=data["name"],
            description=data.get("description"),
            system_type=data.get("system_type"),
            panel_kw=data.get("panel_kw"),
            inverter_kva=data.get("inverter_kva"),
            battery_kwh=data.get("battery_kwh"),
            location=data.get("location"),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            project_value_excl_vat=data.get("project_value_excl_vat"),
            site_contact_person=data.get("site_contact_person"),
            site_phone=data.get("site_phone"),
            design_type=data.get("design_type", "Quick"),
            project_type=data.get("project_type", "Residential"),
            tariff_id=data.get("tariff_id"),
            custom_flat_rate=data.get("custom_flat_rate"),
            created_by_id=user_id,
        )
        db.session.add(new_project)
        db.session.commit()
        return (
            jsonify(
                {"message": "Project added successfully!", "project_id": new_project.id}
            ),
            201,
        )
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/projects/<int:project_id>", methods=["PUT"])
@jwt_required(optional=True)
def update_project(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404

        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        if "panel_id" in data:
            project.panel_id = data["panel_id"] or None
        if "panel_kw" in data:
            project.panel_kw = float(data["panel_kw"] or 0)

        # Handle new quantity format
        for key in ["inverter_kva", "battery_kwh"]:
            if key in data:
                if isinstance(data[key], dict):
                    # new format with capacity and quantity
                    setattr(project, key, data[key])
                elif data[key] is not None:
                    # Backward compatibility
                    if key == "inverter_kva":
                        setattr(project, key, {"capacity": data[key], "quantity": 1})
                    else:
                        setattr(project, key, {"capacity": data[key], "quantity": 1})
                else:
                    setattr(project, key, None)

        # Handle other fields
        for key, value in data.items():
            if key not in ["inverter_kva", "battery_kwh"]:
                setattr(project, key, value)

        if "use_pvgis" in data:
            project.use_pvgis = data["use_pvgis"]
        if "generation_profile_name" in data:
            project.generation_profile_name = data["generation_profile_name"]

        if "generator_config" in data:
            project.generator_config = data["generator_config"]

        # Handle tariff fields with the clearing logic
        if "tariff_id" in data and data["tariff_id"] is not None:
            project.tariff_id = data["tariff_id"]
            project.custom_flat_rate = None  # Clear the other type
        elif "custom_flat_rate" in data and data["custom_flat_rate"] is not None:
            project.custom_flat_rate = data["custom_flat_rate"]
            project.tariff_id = None  # Clear the other type

        mark_project_activity(project_id, optional_user_id())

        db.session.commit()
        return jsonify({"message": "Project updated successfully!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/projects/<int:project_id>", methods=["DELETE"])
@jwt_required()
def delete_project(project_id):
    user = User.query.get(get_jwt_identity())
    if not user or user.role != UserRole.ADMIN:
        return (
            jsonify(
                {
                    "error": "forbidden",
                    "message": "Access Restricted: Only administrators can delete projects.",
                }
            ),
            403,
        )
    try:
        project = Projects.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        if project.is_deleted:
            return jsonify({"error": "Project already deleted"}), 400

        project.is_deleted = True
        project.deleted_at = datetime.now()
        project.deleted_by_id = user.id
        # Bulk delete children to avoid per-row cascade overhead
        # db.session.query(EnergyData).filter_by(project_id=project_id).delete(synchronize_session=False)
        # db.session.query(BOMComponent).filter_by(project_id=project_id).delete(synchronize_session=False)
        # db.session.query(QuickDesignData).filter_by(project_id=project_id).delete(synchronize_session=False)
        # db.session.delete(project)

        db.session.add(project)
        db.session.commit()
        return jsonify({"message": "Project moved to recycle bin!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# Endpoint to find compatible products based on rules
@projects_bp.route("/compatible_products", methods=["GET"])
def get_compatible_products():
    subject_id = request.args.get("subject_id", type=int)
    object_category = request.args.get("category", type=str)

    if not subject_id or not object_category:
        return (
            jsonify({"error": "subject_id and category are required parameters"}),
            400,
        )

    # Base query for the category of products we want
    query = Product.query.filter_by(category=object_category)

    # Handle REQUIRE rules
    require_rule = ComponentRule.query.filter_by(
        subject_product_id=subject_id,
        rule_type="REQUIRES_ONE",
        object_category=object_category,
    ).first()

    if require_rule and require_rule.constraints:
        for key, value in require_rule.constraints.items():
            query = query.filter(Product.properties[key].astext == str(value))

    # Get all exclusion rules for the subject product
    exclusion_rules = ComponentRule.query.filter_by(
        subject_product_id=subject_id,
        rule_type="EXCLUDES",
        object_category=object_category,
    ).all()

    # Apply exclusion rules to the query
    for rule in exclusion_rules:
        if rule.constraints:
            for key, value in rule.constraints.items():
                # This filters the JSONB 'properties' column
                query = query.filter(Product.properties[key].astext != str(value))

    compatible_products = query.all()
    return jsonify([p.as_dict() for p in compatible_products])


@projects_bp.route("/load_profiles", methods=["GET"])
def get_load_profiles():
    try:
        consumer_type_filter = request.args.get("consumer_type")  # Optional filter

        query = LoadProfiles.query
        if consumer_type_filter:
            query = query.filter(LoadProfiles.profile_type == consumer_type_filter)

        profiles = query.all()

        profiles_list = []
        for profile in profiles:
            profiles_list.append(
                {
                    "id": profile.id,
                    "name": profile.name,
                    "description": profile.description,
                    "profile_type": profile.profile_type,  # Changed from consumer_type to match your model
                    "annual_kwh": profile.annual_kwh,
                    "monthly_avg_kwh_original": profile.monthly_avg_kwh_original,
                    "max_peak_demand_kw": profile.max_peak_demand_kw,
                    "profile_data": profile.profile_data,  # This is the array of data points
                }
            )
        return jsonify(profiles_list), 200
    except Exception as e:
        print(f"Error fetching load profiles: {str(e)}")  # Log error
        return (
            jsonify({"error": "Failed to fetch load profiles", "details": str(e)}),
            500,
        )


@projects_bp.route("/projects/recyclebin", methods=["GET"])
@jwt_required()
def list_deleted_projects():
    try:
        rows = (
            Projects.query.filter(Projects.is_deleted.is_(True))
            .order_by(Projects.deleted_at.desc())
            .all()
        )
        return jsonify(
            [
                {
                    "id": p.id,
                    "name": p.name,
                    "client_name": p.client.client_name if p.client else None,
                    "location": p.location,
                    "system_type": p.system_type,
                    "design_type": p.design_type,
                    "deleted_at": p.deleted_at.isoformat() if p.deleted_at else None,
                    "deleted_by_name": p.deleted_by.full_name if p.deleted_by else None,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in rows
            ]
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/projects/<int:project_id>/restore", methods=["POST"])
@jwt_required()
def restore_project(project_id):
    try:
        project = Projects.query.get(project_id)
        if not project or not project.is_deleted:
            return jsonify({"error": "Project not found or not deleted"}), 404
        project.is_deleted = False
        project.deleted_at = None
        project.deleted_by_id = None
        db.session.add(project)
        db.session.commit()
        return jsonify({"message": "Project restored"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@projects_bp.route("/projects/<int:project_id>/permanent", methods=["DELETE"])
@jwt_required()
def permanent_delete_project(project_id):
    """
    Optional: irreversible removal. Only allow if you genuinely want to purge.
    """
    user = User.query.get(get_jwt_identity())
    if not user or user.role != UserRole.ADMIN:
        return jsonify({"error": "forbidden"}), 403
    try:
        project = Projects.query.get(project_id)
        if not project or not project.is_deleted:
            return jsonify({"error": "Project not found or not in recycle bin"}), 404

        # You can decide NOT to delete related documents to keep historical records.
        # Safer approach: reject permanent delete if documents exist.
        doc_exists = Document.query.filter_by(project_id=project_id).first()
        if doc_exists:
            return (
                jsonify({"error": "Project has documents; permanent delete blocked"}),
                400,
            )

        db.session.delete(project)
        db.session.commit()
        return jsonify({"message": "Project permanently deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
