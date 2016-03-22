declare module "is-my-json-valid" {
    interface Validator {
        (object: Object): boolean;
        // TODO: Create typing for errors.
        errors: Object[];
    }

    function validator(schema: Object): Validator;
    export = validator;
}
